import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus } from "lucide-react";
import { CustomerDialog } from "./CustomerDialog";
import { useState } from "react";
import { SearchCommand } from "./SearchCommand";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const CustomerList = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error: any) {
        console.error('Error fetching customers:', error);
        toast({
          title: "Error fetching customers",
          description: error.message,
          variant: "destructive",
        });
        return [];
      }
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (error: any) {
        console.error('Error deleting customer:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete customer: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      setSelectedCustomer(data);
      setDialogOpen(true);
    } catch (error: any) {
      console.error('Error fetching customer:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customer details: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      deleteCustomerMutation.mutate(id);
    }
  };

  const handleSubmit = async (customerData: any) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .upsert(customerData)
        .select()
        .single();

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      return data;
    } catch (error: any) {
      console.error('Error saving customer:', error);
      throw error;
    }
  };

  const filteredCustomers = customers.filter((customer: any) =>
    Object.values(customer).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (isLoading) return <div>Loading customers...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <SearchCommand data={customers} setFilteredData={setSearchQuery} />
        <Button
          onClick={() => {
            setSelectedCustomer(null);
            setDialogOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Surname</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Social Network</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map((customer: any) => (
              <TableRow key={customer.id}>
                <TableCell className="min-w-[150px] max-w-[200px] p-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="line-clamp-2">{customer.title}</div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px] whitespace-pre-wrap">
                        {customer.title}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="min-w-[120px] max-w-[150px] p-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="line-clamp-2">{customer.user_surname}</div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px] whitespace-pre-wrap">
                        {customer.user_surname}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="min-w-[120px] max-w-[150px] p-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="line-clamp-2">{customer.user_number}</div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px] whitespace-pre-wrap">
                        {customer.user_number}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="min-w-[150px] max-w-[200px] p-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="line-clamp-2">{customer.social_network_link}</div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px] whitespace-pre-wrap">
                        {customer.social_network_link}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="min-w-[200px] max-w-[300px] p-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="line-clamp-3">{customer.event_notes}</div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px] whitespace-pre-wrap">
                        {customer.event_notes}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="min-w-[120px] p-4">
                  {customer.payment_status}
                </TableCell>
                <TableCell className="min-w-[100px] p-4">
                  {customer.payment_amount}
                </TableCell>
                <TableCell className="min-w-[100px] p-4">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(customer.id)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(customer.id)}
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        customer={selectedCustomer}
      />
    </div>
  );
};