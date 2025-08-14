
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Copy, FileSpreadsheet, AlertCircle, User, UserCog } from "lucide-react";
import { CustomerDialog } from "./CustomerDialog";
import { useToast } from "@/components/ui/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { SearchCommand } from "./SearchCommand";
import { DateRangeSelect } from "@/components/Statistics/DateRangeSelect";
import * as XLSX from 'xlsx';
import { LanguageText } from "@/components/shared/LanguageText";
import { getCurrencySymbol } from "@/lib/currency";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { PermissionGate } from "@/components/PermissionGate";
import { useSubUserPermissions } from "@/hooks/useSubUserPermissions";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCRMData } from "@/hooks/useCRMData";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PaymentStatus } from "@/lib/types";

const LoadingCustomerList = React.memo(() => {
  return (
    <div className="space-y-4 w-full max-w-[100vw] px-2 md:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
          <Skeleton className="h-8 w-32 -mt-4" />
          <Skeleton className="w-full md:w-[200px] h-10" />
          <Skeleton className="w-full md:w-[200px] h-10" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="space-y-3">
            <div className="flex gap-4 py-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-8 flex-1" />
              ))}
            </div>
            
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex gap-4 py-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                  <Skeleton key={j} className="h-10 flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-6 w-32" />
      </div>
    </div>
  );
});

LoadingCustomerList.displayName = 'LoadingCustomerList';

interface CustomerListProps {
  isPublicMode?: boolean;
  externalUserName?: string;
  externalUserEmail?: string;
  publicBoardUserId?: string;
  hasPermissions?: boolean;
}

export const CustomerList = ({ 
  isPublicMode = false, 
  externalUserName, 
  externalUserEmail,
  publicBoardUserId,
  hasPermissions = false
}: CustomerListProps = {}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();
  const currentDate = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });
  const [hoveredField, setHoveredField] = useState<{id: string, field: string} | null>(null);
  const searchValueRef = useRef("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  
  // Get currency symbol based on language
  const currencySymbol = useMemo(() => getCurrencySymbol(language), [language]);
  const isGeorgian = language === 'ka';

  const { combinedData, isLoading, isFetching } = useCRMData(
    isPublicMode ? publicBoardUserId : user?.id, 
    dateRange
  );

  useEffect(() => {
    if (combinedData.length > 0 && !searchValueRef.current) {
      setFilteredData(combinedData);
    }
  }, [combinedData]);

  useEffect(() => {
    const handleSearchUpdate = (e: CustomEvent) => {
      searchValueRef.current = e.detail || "";
    };
    
    window.addEventListener('crm-search-updated', handleSearchUpdate as any);
    return () => window.removeEventListener('crm-search-updated', handleSearchUpdate as any);
  }, []);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  const handleDeleteCustomer = useCallback(async (customer: any) => {
    if (!user?.id) {
      toast({
        title: t("common.error"),
        description: t("common.missingUserInfo"),
        variant: "destructive",
      });
      return;
    }

    setCustomerToDelete(customer);
    setIsDeleteConfirmOpen(true);
  }, [user?.id, t, toast]);

  const canEditDelete = useCallback((customer: any) => {
    if (!isPublicMode) return true;
    
    // In public mode, allow edit/delete if:
    // 1. The item was created by this sub-user (directly or via events), OR
    // 2. Legacy data without creator info (for backwards compatibility)
    return (customer.created_by_type === 'sub_user' && customer.created_by_name === externalUserName) ||
           (!customer.created_by_type && !customer.created_by_name);
  }, [isPublicMode, externalUserName]);

  const handleConfirmDelete = useCallback(async () => {
    if (!customerToDelete || !user?.id) return;

    // Check permissions in public mode
    if (isPublicMode && !canEditDelete(customerToDelete)) {
      toast({
        title: t("common.error"),
        description: "You can only delete items you created",
        variant: "destructive",
      });
      return;
    }

    try {
      if (customerToDelete.id.startsWith('event-')) {
        const eventId = customerToDelete.id.replace('event-', '');
        const { error } = await supabase
          .from('events')
          .update({ 
            deleted_at: new Date().toISOString(),
            last_edited_by_type: isPublicMode ? 'sub_user' : 'admin',
            last_edited_by_name: isPublicMode ? externalUserName : user.email,
            last_edited_at: new Date().toISOString()
          })
          .eq('id', eventId)
          .eq('user_id', isPublicMode ? publicBoardUserId : user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .update({ 
            deleted_at: new Date().toISOString(),
            last_edited_by_type: isPublicMode ? 'sub_user' : 'admin',
            last_edited_by_name: isPublicMode ? externalUserName : user.email,
            last_edited_at: new Date().toISOString()
          })
          .eq('id', customerToDelete.id)
          .eq('user_id', isPublicMode ? publicBoardUserId : user.id);

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
      setIsDeleteConfirmOpen(false);
      setCustomerToDelete(null);
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.deleteError"),
        variant: "destructive",
      });
    }
  }, [customerToDelete, user?.id, queryClient, toast, t, isPublicMode, canEditDelete, externalUserName]);

  const handleSearchSelect = useCallback((customer: any) => {
    openEditDialog(customer);
  }, []);

  const truncateText = useCallback((text: string, maxLength: number = 30) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }, []);

  const handleCopyText = useCallback(async (text: string) => {
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
  }, [toast, t]);

  const formatDate = useCallback((date: string | null) => {
    if (!date) return '-';
    const dateObj = new Date(date);
    return format(dateObj, 'dd.MM.yyyy');
  }, []);

  const formatTimeRange = useCallback((startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) return '-';
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, 'hh:mma')}-${format(end, 'hh:mma')}`.toLowerCase();
  }, []);

  const formatPaymentStatus = useCallback((status: PaymentStatus | string, amount: number | null) => {
    if (!status) return '-';
    
    const normalizedStatus = 
      status.includes('partly') ? 'partly' : 
      status.includes('fully') ? 'fully' : 
      'not_paid';
    
    let textColorClass = '';
    
    switch(normalizedStatus) {
      case 'fully':
        textColorClass = 'text-green-600';
        break;
      case 'partly':
        textColorClass = 'text-amber-600';
        break;
      default: // not_paid
        textColorClass = 'text-[#ea384c]';
        break;
    }
    
    let displayStatus = '';
    switch (normalizedStatus) {
      case 'not_paid':
        displayStatus = language === 'en' ? 'Not Paid' : 
                        language === 'es' ? 'No Pagado' : 
                        'გადაუხდელი';
        break;
      case 'partly':
        displayStatus = language === 'en' ? 'Partly Paid' : 
                        language === 'es' ? 'Pagado Parcialmente' : 
                        'ნაწილობრივ გადახდილი';
        break;
      case 'fully':
        displayStatus = language === 'en' ? 'Fully Paid' : 
                        language === 'es' ? 'Pagado Completamente' : 
                        'სრულად გადახდილი';
        break;
      default:
        displayStatus = status;
    }
    
    if (normalizedStatus === 'not_paid') {
      return (
        <span className={textColorClass}>
          {displayStatus}
        </span>
      );
    }
    
    return (
      <div className={`font-medium ${textColorClass}`}>
        {displayStatus}
        {(normalizedStatus === 'partly' || normalizedStatus === 'fully') && amount && (
          <div className="text-xs mt-0.5">
            ({currencySymbol}{amount.toFixed(2)})
          </div>
        )}
      </div>
    );
  }, [language, currencySymbol]);

  const openCreateDialog = useCallback(() => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((customer: any) => {
    const originalData = customer;
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
  }, []);

  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  }, []);

  const handleDateRangeChange = useCallback((start: Date, end: Date | null) => {
    setDateRange({ 
      start, 
      end: end || start 
    });
  }, []);

  const handleExcelDownload = useCallback(() => {
    if (!filteredData.length) return;

    // Get currency symbol based on current language
    const currencySymbol = getCurrencySymbol(language);

    const excelData = filteredData.map(customer => {
      const paymentStatusText = customer.payment_status ? 
        customer.payment_status === 'not_paid' ? t("crm.notPaid") :
        customer.payment_status === 'partly' ? t("crm.paidPartly") :
        customer.payment_status === 'fully' ? t("crm.paidFully") :
        customer.payment_status : '';

      return {
        [t("crm.fullNameRequired")]: customer.title || '',
        [t("crm.phoneNumber")]: customer.user_number || '',
        [t("crm.socialLinkEmail")]: customer.social_network_link || '',
        [t("crm.paymentStatus")]: paymentStatusText,
        [t("crm.paymentAmount")]: customer.payment_amount ? `${currencySymbol}${customer.payment_amount}` : '',
        [t("events.date")]: customer.start_date ? format(new Date(customer.start_date), 'dd.MM.yyyy') : '',
        [t("events.time")]: customer.start_date && customer.end_date ? 
          formatTimeRange(customer.start_date, customer.end_date) : '',
        [t("crm.comment")]: customer.event_notes || '',
        [t("crm.dates")]: customer.id?.startsWith('event-') || (customer.start_date && customer.end_date) ? t("crm.yes") : t("crm.no")
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

    // Fix Excel sheet name limitation (max 31 chars)
    const sheetName = t("crm.title").substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const currentDate = format(new Date(), 'dd-MM-yyyy');
    XLSX.writeFile(wb, `${t("crm.title").toLowerCase()}-${currentDate}.xlsx`);

    toast({
      title: t("dashboard.exportSuccessful"),
      description: t("dashboard.exportSuccessMessage"),
    });
  }, [filteredData, language, t, toast, formatTimeRange]);

  const totalPages = useMemo(() => 
    Math.ceil(filteredData.length / pageSize),
    [filteredData.length, pageSize]
  );

  if (isLoading && combinedData.length === 0) {
    return <LoadingCustomerList />;
  }

  return (
    <div className="space-y-4 w-full max-w-[100vw] px-2 md:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
          <h2 className="text-2xl font-bold md:mb-0 -mt-4">{t("crm.title")}</h2>
          <div className="w-full md:w-auto md:min-w-[200px]">
            <DateRangeSelect 
              selectedDate={dateRange}
              onDateChange={handleDateRangeChange}
              disabled={isFetching}
            />
          </div>
          <div className="w-full md:w-auto">
            <SearchCommand
              data={combinedData}
              setFilteredData={setFilteredData}
              isLoading={isFetching}
              resetPagination={resetPagination}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExcelDownload}
            className="h-9 w-9 sm:-mt-4"
            title={language === 'es' ? "Descargar como Excel" : "Download as Excel"}
            disabled={isFetching || filteredData.length === 0}
          >
            <FileSpreadsheet className="h-5 w-5" />
          </Button>
        </div>
        <Button 
          onClick={openCreateDialog} 
          className="flex items-center gap-2 whitespace-nowrap"
          disabled={isFetching}
        >
          <PlusCircle className="w-4 h-4" />
          {t("crm.addCustomer")}
        </Button>
      </div>

      {!(isFetching && !isLoading) && filteredData.length > 0 && (
        <>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1000px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px]">
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="medium">სრული სახელი</GeorgianAuthText>
                      ) : (
                        t("crm.fullNameRequired")
                      )}
                    </TableHead>
                    <TableHead className="w-[130px]">
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="medium">ტელეფონის ნომერი</GeorgianAuthText>
                      ) : (
                        t("crm.phoneNumber")
                      )}
                    </TableHead>
                    <TableHead className="w-[250px]">{t("crm.socialLinkEmail")}</TableHead>
                    <TableHead className="w-[120px]">
                      {language === 'en' ? 'Payment Status' : 
                       language === 'es' ? 'Estado de Pago' : 
                       'გადახდის სტატუსი'}
                    </TableHead>
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
                            title={isPublicMode ? "View/Edit (read-only unless you created it)" : "Edit"}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCustomer(customer)}
                            disabled={isPublicMode && !canEditDelete(customer)}
                            title={isPublicMode && !canEditDelete(customer) ? "You can only delete items you created" : "Delete"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isPublicMode && (
                            <div className="flex items-center ml-2">
                              {customer.created_by_type === 'sub_user' ? (
                                <User className="w-3 h-3 text-blue-500" />
                              ) : (
                                <UserCog className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                          )}
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
        </>
      )}

      <CustomerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customerId={selectedCustomer?.id}
        initialData={selectedCustomer}
        isPublicMode={isPublicMode}
        externalUserName={externalUserName}
        externalUserEmail={externalUserEmail}
        publicBoardUserId={publicBoardUserId}
      />

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("common.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerList;
