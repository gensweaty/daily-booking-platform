import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CustomerDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  eventNotes: string;
  setEventNotes: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  customerId?: string;
  createEvent: boolean;
  setCreateEvent: (value: boolean) => void;
  isEventData: boolean;
  isOpen: boolean;
  displayedFiles?: any[];
  onFileDeleted?: (fileId: string) => void;
}

export const CustomerDialogFields = ({
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  eventNotes,
  setEventNotes,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  customerId,
  createEvent,
  setCreateEvent,
  isEventData,
  isOpen,
  displayedFiles = [],
  onFileDeleted,
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();

  useEffect(() => {
    const formData = {
      title,
      userNumber,
      socialNetworkLink,
      eventNotes,
      startDate,
      endDate,
      paymentStatus,
      paymentAmount,
      createEvent,
    };
    sessionStorage.setItem('customerFormData', JSON.stringify(formData));
  }, [title, userNumber, socialNetworkLink, eventNotes, startDate, endDate, paymentStatus, paymentAmount, createEvent]);

  useEffect(() => {
    const savedFormData = sessionStorage.getItem('customerFormData');
    if (savedFormData && !title) {
      const parsedData = JSON.parse(savedFormData);
      setTitle(parsedData.title || '');
      setUserNumber(parsedData.userNumber || '');
      setSocialNetworkLink(parsedData.socialNetworkLink || '');
      setEventNotes(parsedData.eventNotes || '');
      setStartDate(parsedData.startDate || '');
      setEndDate(parsedData.endDate || '');
      setPaymentStatus(parsedData.paymentStatus || '');
      setPaymentAmount(parsedData.paymentAmount || '');
      setCreateEvent(parsedData.createEvent || false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      sessionStorage.removeItem('customerFormData');
    }
  }, [isOpen]);

  const { data: fetchedFiles = [], isError } = useQuery({
    queryKey: ['customerFiles', customerId, isEventData],
    queryFn: async () => {
      if (!customerId) return [];
      
      console.log('Fetching files for customer:', customerId, 'isEventData:', isEventData);
      
      try {
        let files = [];
        const uniqueFilePaths = new Map();
        
        if (isEventData) {
          // Get files from event_files
          const { data: eventFiles, error: eventFilesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', customerId);
            
          if (eventFilesError) {
            console.error('Error fetching event files:', eventFilesError);
          } else {
            eventFiles?.forEach(file => {
              if (!uniqueFilePaths.has(file.file_path)) {
                uniqueFilePaths.set(file.file_path, file);
              }
            });
          }
        } else {
          // Get files from customer_files_new
          const { data: customerFiles, error: customerFilesError } = await supabase
            .from('customer_files_new')
            .select('*')
            .eq('customer_id', customerId);
            
          if (customerFilesError) {
            console.error('Error fetching customer files:', customerFilesError);
          } else {
            customerFiles?.forEach(file => {
              if (!uniqueFilePaths.has(file.file_path)) {
                uniqueFilePaths.set(file.file_path, file);
              }
            });
          }
        }
        
        files = Array.from(uniqueFilePaths.values());
        console.log('Found unique files:', files);
        return files;
      } catch (error) {
        console.error('Error in file fetching:', error);
        return [];
      }
    },
    enabled: !!customerId,
    staleTime: 0,
    gcTime: Infinity,
    refetchOnWindowFocus: true,
    retry: 1
  });

  useEffect(() => {
    if (!customerId) return;
    
    const fetchCustomerData = async () => {
      try {
        const { data: customer, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching customer:', error);
          return;
        }

        if (customer) {
          const hasEvent = customer.start_date !== null && customer.end_date !== null;
          setCreateEvent(hasEvent);
          
          if (!hasEvent) {
            setStartDate('');
            setEndDate('');
          }
        }
      } catch (error) {
        console.error('Error in fetchCustomerData:', error);
      }
    };

    fetchCustomerData();
  }, [customerId, setCreateEvent, setStartDate, setEndDate]);

  const allFiles = useMemo(() => fetchedFiles, [fetchedFiles]);

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div className="space-y-1">
          <Label htmlFor="title">{t("crm.fullNameRequired")}</Label>
          <Input
            id="title"
            placeholder={t("crm.fullNamePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="number">{t("crm.phoneNumber")}</Label>
          <Input
            id="number"
            type="tel"
            placeholder={t("crm.phoneNumberPlaceholder")}
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="socialNetwork">{t("crm.socialLinkEmail")}</Label>
        <Input
          id="socialNetwork"
          type="text"
          placeholder={t("crm.socialLinkEmailPlaceholder")}
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="createEvent"
          checked={createEvent}
          onCheckedChange={(checked) => {
            setCreateEvent(checked as boolean);
            if (!checked) {
              setStartDate('');
              setEndDate('');
            }
          }}
        />
        <Label htmlFor="createEvent">{t("crm.createEventForCustomer")}</Label>
      </div>

      {createEvent && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="startDate">{t("events.date")}</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required={createEvent}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endDate">{t("events.endDate")}</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required={createEvent}
              className="w-full"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div className="space-y-1">
          <Label>{t("crm.paymentStatus")}</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="w-full bg-background border-input">
              <SelectValue placeholder={t("crm.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent className="bg-background border border-input shadow-md">
              <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
              <SelectItem value="partly">{t("crm.paidPartly")}</SelectItem>
              <SelectItem value="fully">{t("crm.paidFully")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentStatus && paymentStatus !== 'not_paid' && (
          <div className="space-y-1">
            <Label htmlFor="amount">{t("crm.paymentAmount")}</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder={t("crm.paymentAmountPlaceholder")}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              className="w-full"
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">{t("crm.comment")}</Label>
        <Textarea
          id="notes"
          placeholder={t("crm.commentPlaceholder")}
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="min-h-[80px]"
        />
      </div>

      {customerId && allFiles && allFiles.length > 0 && (
        <div className="space-y-1">
          <Label>{t("crm.attachments")}</Label>
          <FileDisplay 
            files={allFiles} 
            bucketName="customer_attachments"
            allowDelete
            onFileDeleted={onFileDeleted}
          />
        </div>
      )}

      <FileUploadField 
        onChange={setSelectedFile}
        onFileChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
      />
    </div>
  );
};
