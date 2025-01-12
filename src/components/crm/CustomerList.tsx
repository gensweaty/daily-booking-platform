import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Copy } from "lucide-react";
import { CustomerDialog } from "./CustomerDialog";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, startOfMonth, endOfMonth, endOfDay } from "date-fns";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { SearchCommand } from "./SearchCommand";
import { DateRangeSelect } from "@/components/Statistics/DateRangeSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          customer_files_new(*)
        `)
        .eq('user_id', user?.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', endOfDay(dateRange.end).toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['events', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          event_files(*)
        `)
        .eq('user_id', user?.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', endOfDay(dateRange.end).toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const combinedData = React.useMemo(() => {
    if (isLoadingCustomers || isLoadingEvents) return [];
    
    const combined = [...customers];
    events.forEach(event => {
      const existingCustomer = customers.find(
        customer => 
          customer.title === event.title &&
          customer.start_date === event.start_date &&
          customer.end_date === event.end_date
      );
      
      if (!existingCustomer) {
        combined.push({
          ...event,
          id: `event-${event.id}`,
          customer_files_new: event.event_files
        });
      }
    });
    return combined;
  }, [customers, events, isLoadingCustomers, isLoadingEvents]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  React.useEffect(() => {
    setFilteredData(combinedData);
  }, [combinedData]);

  const handleCreateCustomer = async (customerData: any) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...customerData, user_id: user?.id }])
        .select()
        .single();

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['customers'] });

      toast({
        title: "Success",
        description: "Customer created successfully",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateCustomer = async (customerData: any) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', selectedCustomer.id)
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['customers'] });

      toast({
        title: "Success",
        description: "Customer updated successfully",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer?.id || !user?.id) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', selectedCustomer.id)
        .eq('user_id', user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['customers'] });

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

  const handleSearchSelect = (customer: any) => {
    openEditDialog(customer);
  };

  const truncateText = (text: string, maxLength: number = 30) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Success",
        description: "Text copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy text",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    const dateObj = new Date(date);
    return format(dateObj, 'dd.MM.yyyy');
  };

  const formatTimeRange = (startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) return '-';
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, 'hh:mma')}-${format(end, 'hh:mma')}`.toLowerCase();
  };

  const formatPaymentStatus = (status: string, amount: number | null) => {
    if (!status) return '-';
    const displayStatus = status.replace('_', ' ');
    
    if ((status === 'partly' || status === 'fully') && amount) {
      return (
        <span className={`capitalize ${
          status === 'fully' ? 'text-green-600' :
          status === 'partly' ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          {displayStatus} (${amount})
        </span>
      );
    }

    return (
      <span className={`capitalize ${
        status === 'fully' ? 'text-green-600' :
        status === 'partly' ? 'text-yellow-600' :
        'text-red-600'
      }`}>
        {displayStatus}
      </span>
    );
  };

  const openCreateDialog = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (customer: any) => {
    const originalData = customer.id.startsWith('event-') 
      ? events.find(e => `event-${e.id}` === customer.id)
      : customer;

    setSelectedCustomer({
      ...originalData,
      title: originalData.title || '',
      user_number: originalData.user_number || '',
      social_network_link: originalData.social_network_link || '',
      event_notes: originalData.event_notes || '',
      payment_status: originalData.payment_status || '',
      payment_amount: originalData.payment_amount?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  if (isLoadingCustomers || isLoadingEvents) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-2xl font-bold">Customers</h2>
        <div className="flex items-center gap-4">
          <SearchCommand
            data={combinedData}
            setFilteredData={setFilteredData}
          />
          <Button onClick={openCreateDialog} className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            Add Customer
          </Button>
        </div>
      </div>

      <DateRangeSelect 
        selectedDate={dateRange}
        onDateChange={(start, end) => setDateRange({ start, end: end || start })}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px]">Full Name</TableHead>
              <TableHead className="w-[130px]">Phone Number</TableHead>
              <TableHead className="w-[250px]">Social Link/Email</TableHead>
              <TableHead className="w-[120px]">Payment Status</TableHead>
              <TableHead className="w-[180px]">Dates</TableHead>
              <TableHead className="w-[120px]">Comment</TableHead>
              <TableHead className="w-[180px]">Attachments</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((customer: any) => (
              <TableRow key={customer.id} className="h-14">
                <TableCell className="py-2">{customer.title}</TableCell>
                <TableCell className="py-2">
                  {customer.user_number ? (
                    <div className="flex items-center gap-2">
                      <span>{customer.user_number}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyText(customer.user_number)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell className="py-2">
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
                        onClick={() => handleCopyText(customer.social_network_link)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  {formatPaymentStatus(customer.payment_status, customer.payment_amount)}
                </TableCell>
                <TableCell className="py-2">
                  <div className="space-y-1 text-sm">
                    <div>{formatDate(customer.start_date)}</div>
                    <div className="text-gray-500">{formatTimeRange(customer.start_date, customer.end_date)}</div>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="text-left">
                          {truncateText(customer.event_notes, 15)}
                        </TooltipTrigger>
                        {customer.event_notes && (
                          <TooltipContent>
                            <p className="max-w-xs whitespace-pre-wrap">{customer.event_notes}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    {customer.event_notes && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyText(customer.event_notes)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  {(customer.customer_files_new?.length > 0 || customer.event_files?.length > 0) ? (
                    <div className="max-w-[180px]">
                      <FileDisplay 
                        files={customer.customer_files_new || customer.event_files}
                        bucketName={customer.id.startsWith('event-') ? "event_attachments" : "customer_attachments"}
                        allowDelete={false}
                      />
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell className="py-2">
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

      <div className="flex justify-end items-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Customers per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="w-[100px] bg-background">
              <SelectValue placeholder="10" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {[10, 20, 50, 100, 500, 1000].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {Math.min((currentPage - 1) * pageSize + 1, filteredData.length)}-{Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length}
        </div>
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
