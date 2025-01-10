import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Copy } from "lucide-react";
import { useState } from "react";
import { CustomerDialog } from "./CustomerDialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const CustomerList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          customer_files(*)
        `)
        .eq('user_id', user?.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleCreateCustomer = async (customerData: any) => {
    const { data, error } = await supabase
      .from('events')
      .insert([customerData])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const handleUpdateCustomer = async (customerData: any) => {
    const { data, error } = await supabase
      .from('events')
      .update(customerData)
      .eq('id', selectedCustomer.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const handleDeleteCustomer = async () => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', selectedCustomer.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
      setIsDialogOpen(false);
      setSelectedCustomer(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    }
  };

  const truncateText = (text: string) => {
    if (!text) return '-';
    return text.length > 30 ? text.substring(0, 30) + '...' : text;
  };

  const handleCopyLink = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Success",
        description: "Link copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (customer: any) => {
    setSelectedCustomer({
      ...customer,
      title: customer.title || '',
      user_number: customer.user_number || '',
      social_network_link: customer.social_network_link || '',
      event_notes: customer.event_notes || '',
      payment_status: customer.payment_status || '',
      payment_amount: customer.payment_amount?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Customers</h2>
        <Button onClick={openCreateDialog} className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4" />
          Add Customer
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Full Name</TableHead>
              <TableHead className="w-[150px]">Phone Number</TableHead>
              <TableHead className="w-[300px]">Social Link/Email</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer: any) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.title}</TableCell>
                <TableCell>{customer.user_number || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="text-left">
                          {truncateText(customer.social_network_link)}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{customer.social_network_link}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {customer.social_network_link && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyLink(customer.social_network_link)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {customer.payment_status ? (
                    <span className={`capitalize ${
                      customer.payment_status === 'fully' ? 'text-green-600' :
                      customer.payment_status === 'partly' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {customer.payment_status.replace('_', ' ')}
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(customer)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        handleDeleteCustomer();
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CustomerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={selectedCustomer ? handleUpdateCustomer : handleCreateCustomer}
        onDelete={selectedCustomer ? handleDeleteCustomer : undefined}
        customer={selectedCustomer}
      />
    </div>
  );
};