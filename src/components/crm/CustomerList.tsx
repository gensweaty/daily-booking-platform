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

  // Add hover states for copyable fields
  const [hoveredPhone, setHoveredPhone] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [hoveredNote, setHoveredNote] = useState<string | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

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
        .or(`start_date.gte.${dateRange.start.toISOString()},created_at.gte.${dateRange.start.toISOString()}`)
        .or(`start_date.lte.${endOfDay(dateRange.end).toISOString()},created_at.lte.${endOfDay(dateRange.end).toISOString()}`);
      
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
        .gte('start_date', dateRange.start.toISOString())
        .lte('start_date', endOfDay(dateRange.end).toISOString());
      
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
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error("Failed to create customer - no data returned");
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });

      toast({
        title: "Success",
        description: "Customer created successfully",
      });

      return data;
    } catch (error: any) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateCustomer = async (customerData: any) => {
    if (!selectedCustomer?.id || !user?.id) {
      toast({
        title: "Error",
        description: "Missing customer or user information",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Attempting to update customer:', selectedCustomer.id);
      
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', selectedCustomer.id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (!data) {
        console.error('No customer found or no permission to update');
        throw new Error("Customer not found or you do not have permission to update it");
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });

      toast({
        title: "Success",
        description: "Customer updated successfully",
      });

      return data;
    } catch (error: any) {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteCustomer = async (customer: any) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Missing customer or user information",
        variant: "destructive",
      });
      return;
    }

    try {
      // First delete associated files from storage
      const { data: files } = await supabase
        .from('customer_files_new')
        .select('*')
        .eq('customer_id', customer.id);

      if (files && files.length > 0) {
        // Delete files from storage
        for (const file of files) {
          const { error: storageError } = await supabase.storage
            .from('customer_attachments')
            .remove([file.file_path]);

          if (storageError) {
            console.error('Error deleting file from storage:', storageError);
          }
        }

        // Delete file records from database
        const { error: filesDeleteError } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('customer_id', customer.id);

        if (filesDeleteError) {
          throw filesDeleteError;
        }
      }

      // Now delete the customer
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id)
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
      console.error('Error deleting customer:', error);
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
    <div className="space-y-4 w-full max-w-[100vw] px-2 md:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
          <h2 className="text-2xl font-bold md:mb-0">Customers</h2>
          <div className="w-full md:w-auto md:min-w-[200px]">
            <DateRangeSelect 
              selectedDate={dateRange}
              onDateChange={(start, end) => setDateRange({ start, end: end || start })}
            />
          </div>
          <div className="w-full md:w-auto">
            <SearchCommand
              data={combinedData}
              setFilteredData={setFilteredData}
            />
          </div>
        </div>
        <Button onClick={openCreateDialog} className="flex items-center gap-2 whitespace-nowrap">
          <PlusCircle className="w-4 h-4" />
          Add Customer
        </Button>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[1000px]">
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
                <TableRow key={customer.id} className="h-auto min-h-[4rem]">
                  <TableCell className="py-2">
                    <div 
                      className="flex items-start gap-2 cursor-pointer group"
                      onMouseEnter={() => setHoveredName(customer.id)}
                      onMouseLeave={() => setHoveredName(null)}
                      onClick={() => handleCopyText(customer.title)}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="line-clamp-2 text-left text-sm group-hover:text-primary">
                              {customer.title}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[300px]">
                            <p className="whitespace-pre-wrap break-words">{customer.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {hoveredName === customer.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 flex-shrink-0 mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText(customer.title);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {customer.user_number ? (
                      <div 
                        className="flex items-start gap-2 cursor-pointer group"
                        onMouseEnter={() => setHoveredPhone(customer.id)}
                        onMouseLeave={() => setHoveredPhone(null)}
                        onClick={() => handleCopyText(customer.user_number)}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="line-clamp-2 text-left text-sm group-hover:text-primary">
                                {customer.user_number}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="whitespace-pre-wrap break-words">{customer.user_number}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {hoveredPhone === customer.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 flex-shrink-0 mt-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(customer.user_number);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="py-2">
                    <div 
                      className="flex items-start gap-2 cursor-pointer group"
                      onMouseEnter={() => setHoveredLink(customer.id)}
                      onMouseLeave={() => setHoveredLink(null)}
                      onClick={() => customer.social_network_link && handleCopyText(customer.social_network_link)}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="line-clamp-2 text-left text-sm group-hover:text-primary">
                              {customer.social_network_link || '-'}
                            </span>
                          </TooltipTrigger>
                          {customer.social_network_link && (
                            <TooltipContent side="right" className="max-w-[300px]">
                              <p className="whitespace-pre-wrap break-words">{customer.social_network_link}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      {customer.social_network_link && hoveredLink === customer.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 flex-shrink-0 mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText(customer.social_network_link);
                          }}
                        >
                          <Copy className="h-3 w-3" />
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
                    <div 
                      className="flex items-start gap-2 cursor-pointer group"
                      onMouseEnter={() => setHoveredNote(customer.id)}
                      onMouseLeave={() => setHoveredNote(null)}
                      onClick={() => customer.event_notes && handleCopyText(customer.event_notes)}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="line-clamp-3 text-left text-sm group-hover:text-primary min-h-[1.5rem]">
                              {customer.event_notes || '-'}
                            </span>
                          </TooltipTrigger>
                          {customer.event_notes && (
                            <TooltipContent side="right" className="max-w-[300px]">
                              <p className="whitespace-pre-wrap break-words">{customer.event_notes}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      {customer.event_notes && hoveredNote === customer.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 flex-shrink-0 mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText(customer.event_notes);
                          }}
                        >
                          <Copy className="h-3 w-3" />
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
                          handleDeleteCustomer(customer);
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
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Customers per page:</span>
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
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        customerId={selectedCustomer?.id}
      />
    </div>
  );
};
