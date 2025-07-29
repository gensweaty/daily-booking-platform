
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { CustomerDialog } from './CustomerDialog';
import { FileDisplay } from "@/components/shared/FileDisplay";
import { SearchCommand } from './SearchCommand';
import { Edit, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { FileRecord } from '@/types/files';

interface Customer {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  user_id: string;
  source?: string;
  create_event?: boolean;
  customer_files_new?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
    created_at: string;
  }>;
  // For event-sourced customers
  event_files?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
    created_at: string;
  }>;
}

interface CustomerListProps {
  customers: Customer[];
  isLoading: boolean;
}

// Hook to get all files related to a customer
const useCustomerFiles = (customer: Customer) => {
  return useQuery({
    queryKey: ['customer-files', customer.id, customer.source],
    queryFn: async () => {
      const allFiles: FileRecord[] = [];
      
      console.log('Fetching files for customer:', customer.id, 'source:', customer.source);

      // If this is an event-sourced customer, get files from event_files
      if (customer.source === 'event' || customer.source === 'booking_request') {
        const eventId = customer.source === 'event' ? 
          customer.id.replace('event-', '') : 
          customer.id.replace('booking-', '');
        
        console.log('Fetching event files for event ID:', eventId);
        
        const { data: eventFiles, error: eventFilesError } = await supabase
          .from('event_files')
          .select('id, filename, file_path, content_type, size, created_at, user_id')
          .eq('event_id', eventId);

        if (eventFilesError) {
          console.error('Error fetching event files:', eventFilesError);
        } else if (eventFiles) {
          eventFiles.forEach(file => {
            allFiles.push({
              id: file.id,
              filename: file.filename,
              file_path: file.file_path,
              content_type: file.content_type,
              size: file.size,
              created_at: file.created_at,
              user_id: file.user_id,
              source: 'event'
            });
          });
        }

        // Also check booking_files table for booking request files
        if (customer.source === 'booking_request') {
          const { data: bookingFiles, error: bookingFilesError } = await supabase
            .from('booking_files')
            .select('id, filename, file_path, content_type, size, created_at, user_id')
            .eq('booking_request_id', eventId);

          if (bookingFilesError) {
            console.error('Error fetching booking files:', bookingFilesError);
          } else if (bookingFiles) {
            bookingFiles.forEach(file => {
              allFiles.push({
                id: file.id,
                filename: file.filename,
                file_path: file.file_path,
                content_type: file.content_type,
                size: file.size,
                created_at: file.created_at,
                user_id: file.user_id,
                source: 'booking_request'
              });
            });
          }
        }
      }
      
      // For standalone customers, get files from customer_files_new
      else if (customer.source === 'standalone' || customer.source === 'additional') {
        const customerId = customer.id;
        
        console.log('Fetching customer files for customer ID:', customerId);
        
        const { data: customerFiles, error: customerFilesError } = await supabase
          .from('customer_files_new')
          .select('id, filename, file_path, content_type, size, created_at, user_id')
          .eq('customer_id', customerId);

        if (customerFilesError) {
          console.error('Error fetching customer files:', customerFilesError);
        } else if (customerFiles) {
          customerFiles.forEach(file => {
            allFiles.push({
              id: file.id,
              filename: file.filename,
              file_path: file.file_path,
              content_type: file.content_type,
              size: file.size,
              created_at: file.created_at,
              user_id: file.user_id,
              source: 'customer'
            });
          });
        }
      }

      // Also include any files that were already loaded in the customer object
      if (customer.customer_files_new) {
        customer.customer_files_new.forEach(file => {
          // Avoid duplicates
          if (!allFiles.find(f => f.id === file.id)) {
            allFiles.push({
              id: file.id,
              filename: file.filename,
              file_path: file.file_path,
              content_type: file.content_type,
              size: file.size,
              created_at: file.created_at,
              user_id: customer.user_id,
              source: 'customer'
            });
          }
        });
      }

      if (customer.event_files) {
        customer.event_files.forEach(file => {
          // Avoid duplicates
          if (!allFiles.find(f => f.id === file.id)) {
            allFiles.push({
              id: file.id,
              filename: file.filename,
              file_path: file.file_path,
              content_type: file.content_type,
              size: file.size,
              created_at: file.created_at,
              user_id: customer.user_id,
              source: 'event'
            });
          }
        });
      }

      console.log('Found total files for customer:', allFiles.length);
      return allFiles;
    },
    enabled: !!customer.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

const CustomerRow: React.FC<{
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  isGeorgian: boolean;
  currencySymbol: string;
}> = ({ customer, onEdit, onDelete, isGeorgian, currencySymbol }) => {
  const { data: files = [] } = useCustomerFiles(customer);
  
  const getBucketName = (files: FileRecord[]) => {
    if (files.length === 0) return 'customer_attachments';
    const firstFile = files[0];
    if (firstFile.source === 'booking_request') return 'booking_attachments';
    if (firstFile.source === 'event') return 'event_attachments';
    return 'customer_attachments';
  };

  return (
    <tr key={customer.id} className="border-b hover:bg-muted/50">
      <td className="px-4 py-3">{customer.title || customer.user_surname || '-'}</td>
      <td className="px-4 py-3">{customer.user_number || '-'}</td>
      <td className="px-4 py-3">{customer.social_network_link || '-'}</td>
      <td className="px-4 py-3">
        {customer.payment_status && (
          <Badge
            variant={
              customer.payment_status === 'fully_paid'
                ? 'default'
                : customer.payment_status === 'partly_paid'
                ? 'secondary'
                : 'outline'
            }
            className={cn(
              customer.payment_status === 'fully_paid' && 'bg-green-600 hover:bg-green-700',
              customer.payment_status === 'partly_paid' && 'bg-orange-600 hover:bg-orange-700 text-white',
              isGeorgian && "font-georgian"
            )}
          >
            {customer.payment_status === 'fully_paid' && (
              isGeorgian ? <GeorgianAuthText>სრულად გადახდილი</GeorgianAuthText> : 'Fully Paid'
            )}
            {customer.payment_status === 'partly_paid' && (
              <>
                {isGeorgian ? <GeorgianAuthText>ნაწილობრივ გადახდილი</GeorgianAuthText> : 'Partly Paid'}
                {customer.payment_amount && (
                  <span className="ml-1">
                    ({currencySymbol}{customer.payment_amount})
                  </span>
                )}
              </>
            )}
            {customer.payment_status === 'not_paid' && (
              isGeorgian ? <GeorgianAuthText>არ არის გადახდილი</GeorgianAuthText> : 'Not Paid'
            )}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {customer.start_date && customer.end_date ? (
          <div className="text-sm">
            {format(new Date(customer.start_date), "dd.MM.yyyy")}
            <br />
            <span className="text-muted-foreground">
              {format(new Date(customer.start_date), "HH:mm")}-{format(new Date(customer.end_date), "HH:mm")}
            </span>
          </div>
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-3">
        <div className="max-w-xs truncate text-sm text-muted-foreground">
          {customer.event_notes || '-'}
        </div>
      </td>
      <td className="px-4 py-3">
        {files.length > 0 ? (
          <FileDisplay 
            files={files}
            bucketName={getBucketName(files)}
            allowDelete={false}
            parentType="customer"
          />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(customer)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(customer)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

export const CustomerList: React.FC<CustomerListProps> = ({ 
  customers, 
  isLoading 
}) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    
    const lowercaseSearch = searchTerm.toLowerCase();
    return customers.filter(customer =>
      (customer.title?.toLowerCase().includes(lowercaseSearch)) ||
      (customer.user_surname?.toLowerCase().includes(lowercaseSearch)) ||
      (customer.user_number?.includes(searchTerm)) ||
      (customer.social_network_link?.toLowerCase().includes(lowercaseSearch)) ||
      (customer.event_notes?.toLowerCase().includes(lowercaseSearch))
    );
  }, [customers, searchTerm]);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
  };

  const handleDelete = async (customer: Customer) => {
    if (isDeleting) return;
    
    setIsDeleting(customer.id);
    try {
      console.log('Deleting customer:', customer.id, 'source:', customer.source);
      
      if (customer.source === 'event' || customer.source === 'booking_request') {
        // For event-sourced customers, we need to handle differently
        const actualId = customer.source === 'event' ? 
          customer.id.replace('event-', '') : 
          customer.id.replace('booking-', '');
          
        // Soft delete the event or booking request
        if (customer.source === 'event') {
          const { error } = await supabase
            .from('events')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', actualId);
          
          if (error) throw error;
        } else if (customer.source === 'booking_request') {
          const { error } = await supabase
            .from('booking_requests')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', actualId);
          
          if (error) throw error;
        }
      } else {
        // For standalone customers
        const { error } = await supabase
          .from('customers')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', customer.id);
        
        if (error) throw error;
      }

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['optimized-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
      
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "crm.customerDeleted"
        }
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        variant: "destructive",
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "crm.errorDeleting"
        }
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleAddCustomer = () => {
    setIsAddingCustomer(true);
  };

  const handleCloseDialog = () => {
    setEditingCustomer(null);
    setIsAddingCustomer(false);
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['optimized-customers'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">
          {isGeorgian ? <GeorgianAuthText>იტვირთება...</GeorgianAuthText> : <LanguageText>{t("common.loading")}</LanguageText>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SearchCommand 
          value={searchTerm}
          onChange={setSearchTerm}
        />
        
        <Button onClick={handleAddCustomer} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {isGeorgian ? <GeorgianAuthText>მომხმარებლის დამატება</GeorgianAuthText> : <LanguageText>{t("crm.addCustomer")}</LanguageText>}
        </Button>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm ? (
            isGeorgian ? <GeorgianAuthText>ძიების შედეგები ვერ მოიძებნა</GeorgianAuthText> : <LanguageText>No search results found</LanguageText>
          ) : (
            isGeorgian ? <GeorgianAuthText>მომხმარებლები ვერ მოიძებნა</GeorgianAuthText> : <LanguageText>No customers found</LanguageText>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>სრული სახელი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
                </th>
                <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t("events.phoneNumber")}</LanguageText>}
                </th>
                <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>ელფოსტა</GeorgianAuthText> : <LanguageText>{t("events.email")}</LanguageText>}
                </th>
                <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
                </th>
                <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>თარიღები</GeorgianAuthText> : <LanguageText>{t("crm.dates")}</LanguageText>}
                </th>
                <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>კომენტარები</GeorgianAuthText> : <LanguageText>{t("crm.comments")}</LanguageText>}
                </th>
                <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>დანართები</GeorgianAuthText> : <LanguageText>{t("common.attachments")}</LanguageText>}
                </th>
                <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>მოქმედებები</GeorgianAuthText> : <LanguageText>{t("crm.actions")}</LanguageText>}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isGeorgian={isGeorgian}
                  currencySymbol={currencySymbol}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editingCustomer || isAddingCustomer) && (
        <CustomerDialog
          open={true}
          onOpenChange={handleCloseDialog}
        />
      )}
    </div>
  );
};
