
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventDialogFieldsProps {
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
  eventId?: string;
  onFileDeleted?: (fileId: string) => void;
}

export const EventDialogFields = ({
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
  eventId,
  onFileDeleted,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  
  const { data: allFiles = [] } = useQuery({
    queryKey: ['eventFiles', eventId, title],
    queryFn: async () => {
      if (!eventId && !title) return [];
      
      try {
        const uniqueFiles = new Map();
        console.log('Starting file fetch for eventId:', eventId, 'and title:', title);

        // First try to get event files if we have an eventId
        if (eventId) {
          const { data: eventFiles, error: eventFilesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', eventId);
          
          if (eventFilesError) throw eventFilesError;

          console.log('Found event files:', eventFiles?.length || 0);
          eventFiles?.forEach(file => {
            const uniqueKey = `${file.file_path}_event`;
            uniqueFiles.set(uniqueKey, {
              ...file,
              source: 'event'
            });
          });
        }

        if (title) {
          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select(`
              id,
              customer_files_new (*)
            `)
            .eq('title', title)
            .maybeSingle();

          if (!customerError && customer?.customer_files_new) {
            console.log('Found customer files:', customer.customer_files_new.length);
            customer.customer_files_new.forEach(file => {
              const uniqueKey = `${file.file_path}_customer`;
              const eventFileKey = `${file.file_path}_event`;
              if (!uniqueFiles.has(eventFileKey)) {
                uniqueFiles.set(uniqueKey, {
                  ...file,
                  source: 'customer'
                });
              }
            });
          }
        }

        const files = Array.from(uniqueFiles.values());
        console.log('Final unique files count:', files.length);
        return files;
      } catch (error) {
        console.error('Error in file fetching:', error);
        return [];
      }
    },
    enabled: !!(eventId || title),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">{t("events.fullNameRequired")}</Label>
        <Input
          id="title"
          placeholder={t("events.fullName")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="number">{t("events.phoneNumber")}</Label>
        <Input
          id="number"
          type="tel"
          placeholder={t("events.phoneNumber")}
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialNetwork">{t("events.socialLinkEmail")}</Label>
        <Input
          id="socialNetwork"
          type="text"
          placeholder={t("events.socialLinkEmail")}
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          className="bg-background border-input"
        />
        <Input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
          className="bg-background border-input"
        />
      </div>

      <div className="space-y-2">
        <Label>{t("events.paymentStatus")}</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-full bg-background border-input">
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent className="bg-background border border-input shadow-md">
            <SelectItem value="not_paid" className="hover:bg-muted focus:bg-muted">
              {t("crm.notPaid")}
            </SelectItem>
            <SelectItem value="partly" className="hover:bg-muted focus:bg-muted">
              {t("crm.paidPartly")}
            </SelectItem>
            <SelectItem value="fully" className="hover:bg-muted focus:bg-muted">
              {t("crm.paidFully")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {paymentStatus && paymentStatus !== 'not_paid' && (
        <div className="space-y-2">
          <Label htmlFor="amount">
            {t("events.paymentAmount")} ({language === 'es' ? '€' : '$'})
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder={`${t("events.paymentAmount")} ${language === 'es' ? '(€)' : '($)'}`}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
            className="bg-background border-input"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">{t("events.eventNotes")}</Label>
        <Textarea
          id="notes"
          placeholder={t("events.addEventNotes")}
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="bg-background border-input"
        />
      </div>

      {(eventId || title) && allFiles && allFiles.length > 0 && (
        <div className="space-y-2">
          <FileDisplay 
            files={allFiles} 
            bucketName="event_attachments"
            allowDelete
            onFileDeleted={onFileDeleted}
          />
        </div>
      )}

      <FileUploadField 
        onFileChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
      />
    </div>
  );
};
