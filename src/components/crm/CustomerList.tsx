
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Copy, FileSpreadsheet, AlertCircle, User, UserCog, Info, Upload, Download, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CRMFiltersProvider, useCRMFilters } from "@/hooks/useCRMFilters";
import { CRMFilterButton } from "./CRMFilterButton";
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
import { PresenceCircles } from "@/components/presence/PresenceCircles";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExcelImportDialog } from "./ExcelImportDialog";

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
  onlineUsers?: Array<{ email?: string | null; name?: string | null; avatar_url?: string | null; online_at?: string | null }>;
  currentUserEmail?: string;
}

const CustomerListContent = ({ 
  isPublicMode = false, 
  externalUserName, 
  externalUserEmail,
  publicBoardUserId,
  hasPermissions = false,
  onlineUsers = [],
  currentUserEmail
}: CustomerListProps = {}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isSubUser } = useSubUserPermissions();
  const { applyFilters } = useCRMFilters();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [pageSize, setPageSize] = useState(20);
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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
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

  // Click outside handler to exit selection mode
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isSelectionMode) return;
      
      const target = e.target as HTMLElement;
      // Don't exit if clicking on the table, select button, or checkboxes
      if (tableContainerRef.current?.contains(target)) return;
      if (target.closest('[data-selection-control]')) return;
      
      setIsSelectionMode(false);
      setSelectedCustomerIds(new Set());
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSelectionMode]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Apply CRM filters to the data
  const displayedData = useMemo(() => {
    const dataToFilter = filteredData.length > 0 ? filteredData : combinedData;
    return applyFilters(dataToFilter);
  }, [filteredData, combinedData, applyFilters]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return displayedData.slice(startIndex, endIndex);
  }, [displayedData, currentPage, pageSize]);

  // Selection mode handlers
  const toggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedCustomerIds(new Set());
    } else {
      setIsSelectionMode(true);
    }
  }, [isSelectionMode]);

  const toggleSelectAll = useCallback(() => {
    const currentPageIds = paginatedData.map((c: any) => c.id);
    const allSelected = currentPageIds.every((id: string) => selectedCustomerIds.has(id));
    
    if (allSelected) {
      // Deselect all
      setSelectedCustomerIds(new Set());
    } else {
      // Select all on current page
      setSelectedCustomerIds(new Set(currentPageIds));
    }
  }, [paginatedData, selectedCustomerIds]);

  const toggleCustomerSelection = useCallback((customerId: string) => {
    setSelectedCustomerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  }, []);

  const allCurrentPageSelected = useMemo(() => {
    if (paginatedData.length === 0) return false;
    return paginatedData.every((c: any) => selectedCustomerIds.has(c.id));
  }, [paginatedData, selectedCustomerIds]);

  // Bulk delete handler - batch operations to handle large datasets
  const handleBulkDelete = useCallback(async () => {
    const effectiveUserId = isPublicMode ? publicBoardUserId : user?.id;
    if (!effectiveUserId || selectedCustomerIds.size === 0) return;

    try {
      const idsToDelete = Array.from(selectedCustomerIds);
      const eventIds = idsToDelete.filter(id => id.startsWith('event-')).map(id => id.replace('event-', ''));
      const customerIds = idsToDelete.filter(id => !id.startsWith('event-'));
      
      const BATCH_SIZE = 100;
      const deleteData = {
        deleted_at: new Date().toISOString(),
        last_edited_by_type: isPublicMode ? 'sub_user' : 'admin',
        last_edited_by_name: isPublicMode ? externalUserName : user?.email,
        last_edited_at: new Date().toISOString()
      };

      // Delete events in batches
      for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
        const batch = eventIds.slice(i, i + BATCH_SIZE);
        const { error: eventError } = await supabase
          .from('events')
          .update(deleteData)
          .in('id', batch)
          .eq('user_id', effectiveUserId);
        if (eventError) throw eventError;
      }

      // Delete customers in batches
      for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
        const batch = customerIds.slice(i, i + BATCH_SIZE);
        const { error: customerError } = await supabase
          .from('customers')
          .update(deleteData)
          .in('id', batch)
          .eq('user_id', effectiveUserId);
        if (customerError) throw customerError;
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['crm-data'] });
      
      toast({
        title: t("common.success"),
        description: `${idsToDelete.length} ${language === 'en' ? 'items deleted successfully' : language === 'es' ? 'elementos eliminados correctamente' : 'ჩანაწერი წარმატებით წაიშალა'}`,
      });
      
      setSelectedCustomerIds(new Set());
      setIsSelectionMode(false);
      setIsBulkDeleteConfirmOpen(false);
    } catch (error: any) {
      console.error('Error bulk deleting:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.deleteError"),
        variant: "destructive",
      });
    }
  }, [selectedCustomerIds, isPublicMode, publicBoardUserId, user?.id, user?.email, externalUserName, queryClient, toast, t, language]);

  // Helper function to get the effective user ID for operations (same as CustomerDialog)
  const getEffectiveUserId = useCallback(() => {
    if (isPublicMode && publicBoardUserId) {
      return publicBoardUserId;
    }
    return user?.id;
  }, [isPublicMode, publicBoardUserId, user?.id]);

  const canEditDelete = useCallback((customer: any) => {
    // For non-public mode (regular authenticated users), check if they're a sub-user
    if (!isPublicMode && !isSubUser) return true;
    
    console.log('🔍 Checking permissions for customer:', {
      id: customer.id,
      created_by_type: customer.created_by_type,
      created_by_name: customer.created_by_name,
      last_edited_by_type: customer.last_edited_by_type,
      last_edited_by_name: customer.last_edited_by_name,
      user_id: customer.user_id,
      externalUserName,
      publicBoardUserId,
      isSubUser,
      currentUserEmail: user?.email
    });
    
    // Permission logic for both public mode (external sub-users) and regular sub-users
    if (isPublicMode) {
      // In public mode, allow edit/delete if:
      // 1. The item was created by this sub-user, OR
      // 2. The item was last edited by this sub-user, OR  
      // 3. Legacy data without creator info but belongs to the board owner (for backwards compatibility)
      const canEdit = (customer.created_by_type === 'sub_user' && customer.created_by_name === externalUserName) ||
             (customer.last_edited_by_type === 'sub_user' && customer.last_edited_by_name === externalUserName) ||
             (!customer.created_by_type && !customer.created_by_name && customer.user_id === publicBoardUserId);
      
      console.log('🔍 Public mode permission result:', canEdit);
      return canEdit;
    } else if (isSubUser) {
      // For regular authenticated sub-users, allow edit/delete if:
      // 1. The item was created by this sub-user (PRIMARY CHECK), OR
      // 2. The item was last edited by this sub-user (SECONDARY CHECK), OR
      // 3. Legacy data without metadata (BACKWARDS COMPATIBILITY)
      const userEmail = user?.email;
      if (!userEmail) return false;
      
      // Primary check: created_by metadata
      if (customer.created_by_type === 'sub_user' && customer.created_by_name === userEmail) {
        console.log('✅ Permission granted: Created by this sub-user');
        return true;
      }
      
      // Secondary check: last_edited_by metadata
      if (customer.last_edited_by_type === 'sub_user' && customer.last_edited_by_name === userEmail) {
        console.log('✅ Permission granted: Last edited by this sub-user');
        return true;
      }
      
      // Legacy fallback: no metadata exists
      if (!customer.created_by_type && !customer.created_by_name && !customer.last_edited_by_type && !customer.last_edited_by_name) {
        console.log('✅ Permission granted: Legacy data without metadata');
        return true;
      }
      
      console.log('❌ Permission denied: Not created or edited by this sub-user');
      return false;
    }
    
    return true; // Admin has all permissions
  }, [isPublicMode, externalUserName, publicBoardUserId, isSubUser, user?.email, user?.id]);

  const handleDeleteCustomer = useCallback(async (customer: any) => {
    const effectiveUserId = getEffectiveUserId();
    
    console.log('🗑️ Delete customer clicked:', {
      customerId: customer.id,
      hasPermissions,
      isPublicMode,
      userAgent: navigator.userAgent,
      canEditDelete: canEditDelete(customer),
      effectiveUserId,
      publicBoardUserId
    });
    
    if (!effectiveUserId || effectiveUserId === 'temp-public-user') {
      console.log('❌ No effective user ID available');
      toast({
        title: t("common.error"),
        description: isPublicMode ? "Board owner authentication required" : t("common.missingUserInfo"),
        variant: "destructive",
      });
      return;
    }

    // Check permissions before opening dialog
    if (!canEditDelete(customer)) {
      console.log('❌ No permission to delete this customer');
      toast({
        title: t("common.error"),
        description: "You can only delete items you created",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Opening delete confirmation dialog');
    setCustomerToDelete(customer);
    setIsDeleteConfirmOpen(true);
  }, [getEffectiveUserId, t, toast, hasPermissions, isPublicMode, canEditDelete]);

  const handleConfirmDelete = useCallback(async () => {
    const effectiveUserId = getEffectiveUserId();
    if (!customerToDelete || !effectiveUserId) return;

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
            last_edited_by_name: isPublicMode ? externalUserName : user?.email,
            last_edited_at: new Date().toISOString()
          })
          .eq('id', eventId)
          .eq('user_id', effectiveUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .update({ 
            deleted_at: new Date().toISOString(),
            last_edited_by_type: isPublicMode ? 'sub_user' : 'admin',
            last_edited_by_name: isPublicMode ? externalUserName : user?.email,
            last_edited_at: new Date().toISOString()
          })
          .eq('id', customerToDelete.id)
          .eq('user_id', effectiveUserId);

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
  }, [customerToDelete, getEffectiveUserId, queryClient, toast, t, isPublicMode, canEditDelete, externalUserName, user?.email]);

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
          <div className={`text-xs mt-0.5 ${language === 'ka' ? 'georgian-numbers' : ''}`}>
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
    if (!displayedData.length) return;

    // Get currency symbol based on current language
    const currencySymbol = getCurrencySymbol(language);

    const excelData = displayedData.map(customer => {
      const paymentStatusText = customer.payment_status ? 
        customer.payment_status === 'not_paid' ? t("crm.notPaid") :
        customer.payment_status === 'partly' ? t("crm.paidPartly") :
        customer.payment_status === 'fully' ? t("crm.paidFully") :
        customer.payment_status : '';

      return {
        [language === 'ka' ? 'სრული სახელი' : t("crm.fullNameRequired")]: customer.title || '',
        [t("crm.phoneNumber")]: customer.user_number || '',
        [t("crm.socialLinkEmail")]: customer.social_network_link || '',
        [t("crm.paymentStatus")]: paymentStatusText,
        [t("crm.paymentAmount")]: customer.payment_amount ? `${currencySymbol}${customer.payment_amount}` : '',
        [t("crm.eventDate")]: customer.start_date ? 
          `${format(new Date(customer.start_date), 'dd.MM.yyyy')}${customer.end_date ? ` - ${format(new Date(customer.end_date), 'dd.MM.yyyy')}` : ''}` : '-',
        [t("crm.addingDate")]: customer.created_at ? format(new Date(customer.created_at), 'dd.MM.yyyy HH:mm:ss') : '-',
        [t("crm.comment")]: customer.event_notes || '',
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
      { wch: 25 },  // Event Date
      { wch: 20 },  // Adding Date
      { wch: 40 },  // Comment
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
  }, [displayedData, language, t, toast, formatTimeRange]);

  const totalPages = useMemo(() => 
    Math.ceil(displayedData.length / pageSize),
    [displayedData.length, pageSize]
  );

  if (isLoading && combinedData.length === 0) {
    return <LoadingCustomerList />;
  }

  return (
    <div className={cn(
      "space-y-4 w-full max-w-[100vw] px-2 md:px-4 overflow-hidden",
      isPublicMode && "mt-6"
    )}>
      {/* Header and all action buttons on same line */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-4">
        {/* Left side: Title and Presence */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <h2 className="text-lg md:text-xl lg:text-2xl font-bold">
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="bold">CRM</GeorgianAuthText>
            ) : (
              t("crm.title")
            )}
          </h2>
          <div className="shrink-0">
            <PresenceCircles users={onlineUsers ?? []} max={5} />
          </div>
        </div>

        {/* Right side: All action buttons on same line */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <DateRangeSelect 
            selectedDate={dateRange}
            onDateChange={handleDateRangeChange}
            disabled={isFetching}
          />
          <SearchCommand
            data={combinedData}
            setFilteredData={setFilteredData}
            resetPagination={resetPagination}
          />
          <CRMFilterButton boardOwnerId={isPublicMode ? publicBoardUserId : user?.id} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline" 
                size="default"
                className="flex items-center gap-2 h-10 px-3"
                title={t("crm.excelActions")}
                disabled={isFetching}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border-border shadow-lg min-w-[180px]">
              <DropdownMenuItem onClick={handleExcelDownload} className="cursor-pointer">
                <Download className="mr-2 h-4 w-4" />
                {t("crm.exportExcel")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)} disabled={!canEditDelete} className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                {t("crm.importExcel")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            onClick={openCreateDialog} 
            className="flex items-center gap-2 h-10 whitespace-nowrap"
            disabled={isFetching}
          >
            <PlusCircle className="w-4 h-4" />
            {t("crm.addCustomer")}
          </Button>
        </div>
      </div>

      {/* Empty state when no customers */}
      {!(isFetching && !isLoading) && displayedData.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-lg p-8 md:p-12 text-center bg-muted/30">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-muted p-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="semibold">{t("crm.noCustomers")}</GeorgianAuthText>
              ) : (
                t("crm.noCustomers")
              )}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {isGeorgian ? (
                <GeorgianAuthText>{t("crm.noCustomersDescription")}</GeorgianAuthText>
              ) : (
                t("crm.noCustomersDescription")
              )}
            </p>
            {!isFetching && (
              <Button 
                onClick={openCreateDialog}
                className="mt-4"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                {t("crm.addCustomer")}
              </Button>
            )}
          </div>
        </div>
      )}

      {!(isFetching && !isLoading) && displayedData.length > 0 && (
        <>
          <div className="w-full overflow-x-auto relative" ref={tableContainerRef}>
            {/* Mobile scroll indicator - shows there's more content to the right */}
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background/95 via-background/60 to-transparent pointer-events-none z-10 md:hidden flex items-center justify-end pr-2">
              <div className="flex flex-col gap-1 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
              </div>
            </div>
            <div className="min-w-[1000px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {/* Selection column - sticky for mobile visibility */}
                    <TableHead className="w-[48px] min-w-[48px] px-1 sticky left-0 z-20 bg-background">
                      <div className="flex items-center justify-center gap-1" data-selection-control>
                        {isSelectionMode ? (
                          <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                            <button
                              onClick={toggleSelectAll}
                              className="p-1.5 rounded hover:bg-primary/20 transition-colors border border-transparent hover:border-primary/30"
                              data-selection-control
                              title={language === 'en' ? 'Select All' : language === 'es' ? 'Seleccionar Todo' : 'ყველას არჩევა'}
                            >
                              {allCurrentPageSelected ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {selectedCustomerIds.size > 0 && (
                              <button
                                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                                className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-destructive border border-transparent hover:border-destructive/30"
                                data-selection-control
                                title={`${language === 'en' ? 'Delete' : language === 'es' ? 'Eliminar' : 'წაშლა'} (${selectedCustomerIds.size})`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={toggleSelectionMode}
                            className="p-1.5 rounded hover:bg-primary/20 transition-colors border border-border/50 hover:border-primary/50"
                            data-selection-control
                            title={language === 'en' ? 'Select' : language === 'es' ? 'Seleccionar' : 'არჩევა'}
                          >
                            <CheckSquare className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </button>
                        )}
                      </div>
                    </TableHead>
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
                    <TableHead className="w-[150px]">{t("crm.eventDate")}</TableHead>
                    <TableHead className="w-[150px]">{t("crm.addingDate")}</TableHead>
                    <TableHead className="w-[120px]">{t("crm.comment")}</TableHead>
                    <TableHead className="w-[180px]">{t("common.attachments")}</TableHead>
                    <TableHead className="w-[100px]">{t("crm.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {paginatedData.map((customer: any) => (
                    <TableRow key={customer.id} className="h-auto min-h-[4rem]">
                      {/* Selection checkbox cell - sticky for mobile */}
                      <TableCell className="py-2 w-[48px] min-w-[48px] px-1 sticky left-0 z-10 bg-background">
                        <div className="flex items-center justify-center" data-selection-control>
                          {isSelectionMode ? (
                            <Checkbox
                              checked={selectedCustomerIds.has(customer.id)}
                              onCheckedChange={() => toggleCustomerSelection(customer.id)}
                              className="h-4 w-4 transition-all duration-200 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              data-selection-control
                            />
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                        </div>
                      </TableCell>
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
                      <TableCell className={`py-2`}>
                        {formatPaymentStatus(customer.payment_status, customer.payment_amount)}
                      </TableCell>
                      <TableCell className="py-2">
            <div className={`text-xs text-muted-foreground ${language === 'ka' ? 'georgian-numbers' : ''}`}>
              {customer.start_date ? (
                <>
                  {format(new Date(customer.start_date), 'dd.MM.yyyy')}
                  {customer.end_date && ` - ${format(new Date(customer.end_date), 'dd.MM.yyyy')}`}
                </>
              ) : (
                '-'
              )}
            </div>
          </TableCell>
          <TableCell className="py-2">
            <div className={`text-xs text-muted-foreground ${language === 'ka' ? 'georgian-numbers' : ''}`}>
              {customer.created_at ? format(new Date(customer.created_at), language === 'ka' ? 'dd.MM.yyyy HH:mm:ss' : 'dd.MM.yyyy HH:mm') : '-'}
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
                  {[10, 20, 50, 100, 500, 1000, 10000].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              {Math.min((currentPage - 1) * pageSize + 1, displayedData.length)}-{Math.min(currentPage * pageSize, displayedData.length)} {t("common.of")} {displayedData.length}
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

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {language === 'en' 
                ? 'Delete Selected Items?' 
                : language === 'es' 
                ? '¿Eliminar elementos seleccionados?' 
                : 'წაიშალოს არჩეული ჩანაწერები?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {language === 'en' 
                ? `You are about to delete ${selectedCustomerIds.size} selected item${selectedCustomerIds.size > 1 ? 's' : ''}. This action cannot be undone.`
                : language === 'es'
                ? `Está a punto de eliminar ${selectedCustomerIds.size} elemento${selectedCustomerIds.size > 1 ? 's' : ''} seleccionado${selectedCustomerIds.size > 1 ? 's' : ''}. Esta acción no se puede deshacer.`
                : `თქვენ აპირებთ ${selectedCustomerIds.size} არჩეული ჩანაწერის წაშლას. ეს მოქმედება შეუქცევადია.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>
              {language === 'en' ? 'Cancel' : language === 'es' ? 'Cancelar' : 'გაუქმება'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === 'en' 
                ? `Delete ${selectedCustomerIds.size} item${selectedCustomerIds.size > 1 ? 's' : ''}`
                : language === 'es' 
                ? `Eliminar ${selectedCustomerIds.size} elemento${selectedCustomerIds.size > 1 ? 's' : ''}`
                : `წაშლა (${selectedCustomerIds.size})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        userId={isPublicMode ? publicBoardUserId! : user?.id!}
        createdByType={isPublicMode ? 'sub_user' : (isSubUser ? 'sub_user' : 'admin')}
        createdByName={isPublicMode ? externalUserName! : user?.email || ''}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['events'] });
          queryClient.invalidateQueries({ queryKey: ['crm-data'] });
        }}
      />
    </div>
  );
};

export const CustomerList = (props: CustomerListProps) => {
  return (
    <CRMFiltersProvider>
      <CustomerListContent {...props} />
    </CRMFiltersProvider>
  );
};

export default CustomerList;
