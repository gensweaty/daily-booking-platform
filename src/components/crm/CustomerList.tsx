
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Copy, FileSpreadsheet } from "lucide-react";
import { CustomerDialog } from "./CustomerDialog";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, startOfMonth, endOfMonth, endOfDay } from "date-fns";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { SearchCommand } from "./SearchCommand";
import { DateRangeSelect } from "@/components/Statistics/DateRangeSelect";
import * as XLSX from 'xlsx';
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
import { useLanguage } from "@/contexts/LanguageContext";

export const CustomerList = () => {
  const { t, language } = useLanguage();
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
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredField, setHoveredField] = useState<{id: string, field: string} | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        customer_files_new(*)
      `)
      .eq('user_id', user.id)
      .or(`start_date.gte.${dateRange.start.toISOString()},created_at.gte.${dateRange.start.toISOString()}`)
      .or(`start_date.lte.${endOfDay(dateRange.end).toISOString()},created_at.lte.${endOfDay(dateRange.end).toISOString()}`)
      .is('deleted_at', null);

    if (error) throw error;
    return data || [];
  }, [user, dateRange]);

  const fetchEvents = useCallback(async () => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_files(*)
      `)
      .eq('user_id', user.id)
      .gte('start_date', dateRange.start.toISOString())
      .lte('start_date', endOfDay(dateRange.end).toISOString())
      .is('deleted_at', null);

    if (error) throw error;
    return data || [];
  }, [user, dateRange]);

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: fetchCustomers,
    enabled: !!user,
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['events', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: fetchEvents,
    enabled: !!user,
  });

  // Create a memoized version of the combined data
  const combinedData = useMemo(() => {
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

  // Update isLoading state when the queries complete
  useEffect(() => {
    setIsLoading(isLoadingCustomers || isLoadingEvents);
  }, [isLoadingCustomers, isLoadingEvents]);

  // Set filtered data when combined data changes
  useEffect(() => {
    setFilteredData(combinedData);
  }, [combinedData]);

  // Calculate paginated data only when filteredData, currentPage, or pageSize changes
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  const handleDeleteCustomer = async (customer: any) => {
    if (!user?.id) {
      toast({
        title: t("common.error"),
        description: t("common.missingUserInfo"),
        variant: "destructive",
      });
      return;
    }

    try {
      if (customer.id.startsWith('event-')) {
        const eventId = customer.id.replace('event-', '');
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', customer.id)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      toast({
        title: t("common.success"),
        description: t("common.deleteSuccess"),
      });
      
      setIsDialogOpen(false);
      setSelectedCustomer(null);
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.deleteError"),
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
        title: t("common.success"),
        description: t("common.copiedToClipboard"),
      });
    } catch (err) {
      toast({
        title: t("common.error"),
        description: t("common.copyError"),
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
    
    let displayStatus = '';
    switch (status) {
      case 'not_paid':
        displayStatus = t("crm.notPaid");
        break;
      case 'partly':
        displayStatus = t("crm.paidPartly");
        break;
      case 'fully':
        displayStatus = t("crm.paidFully");
        break;
      default:
        displayStatus = status;
    }
    
    if ((status === 'partly' || status === 'fully') && amount) {
      return (
        <span className={`${
          status === 'fully' ? 'text-green-600' :
          status === 'partly' ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          {`${displayStatus} (${language === 'es' ? '€' : '$'}${amount})`}
        </span>
      );
    }

    return (
      <span className={`${
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

  const handleExcelDownload = () => {
    const excelData = filteredData.map(customer => {
      const paymentStatusText = customer.payment_status ? 
        customer.payment_status === 'not_paid' ? t("crm.notPaid") :
        customer.payment_status === 'partly' ? t("crm.paidPartly") :
        customer.payment_status === 'fully' ? t("crm.paidFully") :
        customer.payment_status : '';

      return {
        [t("crm.fullName")]: customer.title || '',
        [t("crm.phoneNumber")]: customer.user_number || '',
        [t("crm.socialLinkEmail")]: customer.social_network_link || '',
        [t("crm.paymentStatus")]: paymentStatusText,
        [t("crm.paymentAmount")]: customer.payment_amount ? `${language === 'es' ? '€' : '$'}${customer.payment_amount}` : '',
        [t("events.date")]: customer.start_date ? format(new Date(customer.start_date), 'dd.MM.yyyy') : '',
        [t("events.time")]: customer.start_date && customer.end_date ? 
          formatTimeRange(customer.start_date, customer.end_date) : '',
        [t("crm.comment")]: customer.event_notes || '',
        [t("crm.dates")]: customer.id.startsWith('event-') || (customer.start_date && customer.end_date) ? t("crm.yes") : t("crm.no")
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    const colWidths = [
      { wch: 20 },  // Full Name
      { wch: 15 },  // Phone Number
      { wch: 30 },  // Social Link/Email
      { wch: 15 },  // Payment Status
      { wch: 15 },  // Payment Amount
      { wch: 12 },  // Date
      { wch: 20 },  // Time
      { wch: 40 },  // Comment
      { wch: 8 }    // Event
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, t("crm.title"));

    const currentDate = format(new Date(), 'dd-MM-yyyy');
    XLSX.writeFile(wb, `${t("crm.title").toLowerCase()}-${currentDate}.xlsx`);

    toast({
      title: t("dashboard.exportSuccessful"),
      description: t("dashboard.exportSuccessMessage"),
    });
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-lg">{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-[100vw] px-2 md:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
          <h2 className="text-2xl font-bold md:mb-0 -mt-4">{t("crm.title")}</h2>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExcelDownload}
            className="h-9 w-9 sm:-mt-4"
            title={language === 'es' ? "Descargar como Excel" : "Download as Excel"}
          >
            <FileSpreadsheet className="h-5 w-5" />
          </Button>
        </div>
        <Button onClick={openCreateDialog} className="flex items-center gap-2 whitespace-nowrap">
          <PlusCircle className="w-4 h-4" />
          {t("crm.addCustomer")}
        </Button>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[1000px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[180px]">{t("crm.fullName")}</TableHead>
                <TableHead className="w-[130px]">{t("crm.phoneNumber")}</TableHead>
                <TableHead className="w-[250px]">{t("crm.socialLinkEmail")}</TableHead>
                <TableHead className="w-[120px]">{t("crm.paymentStatus")}</TableHead>
                <TableHead className="w-[180px]">{t("crm.dates")}</TableHead>
                <TableHead className="w-[120px]">{t("crm.comment")}</TableHead>
                <TableHead className="w-[180px]">{t("common.attachments")}</TableHead>
                <TableHead className="w-[100px]">{t("crm.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((customer: any) => (
                <TableRow key={customer.id} className="h-auto min-h-[4rem]">
                  <TableCell className="py-2">
                    <div 
                      className="flex items-start gap-2 group relative pr-6"
                      onMouseEnter={() => setHoveredField({ id: customer.id, field: 'title' })}
                      onMouseLeave={() => setHoveredField(null)}
                    >
                      <span className="line-clamp-2 text-left text-sm">
                        {customer.title}
                      </span>
                      {hoveredField?.id === customer.id && hoveredField?.field === 'title' && (
                        <Copy 
                          className="h-4 w-4 cursor-pointer hover:text-primary absolute right-0 top-0 opacity-60 hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyText(customer.title)}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {customer.user_number ? (
                      <div 
                        className="flex items-start gap-2 group relative pr-6"
                        onMouseEnter={() => setHoveredField({ id: customer.id, field: 'phone' })}
                        onMouseLeave={() => setHoveredField(null)}
                      >
                        <span className="line-clamp-2 text-left text-sm">
                          {customer.user_number}
                        </span>
                        {hoveredField?.id === customer.id && hoveredField?.field === 'phone' && (
                          <Copy 
                            className="h-4 w-4 cursor-pointer hover:text-primary absolute right-0 top-0 opacity-60 hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyText(customer.user_number)}
                          />
                        )}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="py-2">
                    <div 
                      className="flex items-start gap-2 group relative pr-6"
                      onMouseEnter={() => setHoveredField({ id: customer.id, field: 'link' })}
                      onMouseLeave={() => setHoveredField(null)}
                    >
                      <span className="line-clamp-2 text-left text-sm">
                        {customer.social_network_link || '-'}
                      </span>
                      {customer.social_network_link && hoveredField?.id === customer.id && hoveredField?.field === 'link' && (
                        <Copy 
                          className="h-4 w-4 cursor-pointer hover:text-primary absolute right-0 top-0 opacity-60 hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyText(customer.social_network_link)}
                        />
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
                      className="flex items-start gap-2 group relative pr-6"
                      onMouseEnter={() => setHoveredField({ id: customer.id, field: 'notes' })}
                      onMouseLeave={() => setHoveredField(null)}
                    >
                      <span className="line-clamp-3 text-left text-sm min-h-[1.5rem]">
                        {customer.event_notes || '-'}
                      </span>
                      {customer.event_notes && hoveredField?.id === customer.id && hoveredField?.field === 'notes' && (
                        <Copy 
                          className="h-4 w-4 cursor-pointer hover:text-primary absolute right-0 top-0 opacity-60 hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyText(customer.event_notes)}
                        />
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
                          parentId={customer.id.startsWith('event-') ? customer.id.replace('event-', '') : customer.id}
                          parentType={customer.id.startsWith('event-') ? "event" : "customer"}
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
          <span className="text-sm text-muted-foreground whitespace-nowrap">{t("crm.customersPerPage")}:</span>
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
          {Math.min((currentPage - 1) * pageSize + 1, filteredData.length)}-{Math.min(currentPage * pageSize, filteredData.length)} {t("common.of")} {filteredData.length}
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

export default CustomerList;
