
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { getStorageUrl } from "@/integrations/supabase/client";

interface CustomerDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  createEvent: boolean;
  setCreateEvent: (value: boolean) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  customerNotes: string;
  setCustomerNotes: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  isEventBased?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  bookingFilePath?: string | null;
  bookingFileName?: string | null;
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
  createEvent,
  setCreateEvent,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  customerNotes,
  setCustomerNotes,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  isEventBased = false,
  startDate,
  endDate,
  bookingFilePath,
  bookingFileName,
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return format(date, "PPp"); // Format using date-fns for localized date and time
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateStr;
    }
  };

  // Create a virtual file entry for booking file if it exists
  const bookingFiles = bookingFilePath ? [
    {
      id: `booking-file-${Date.now()}`,
      filename: bookingFileName || 'attachment',
      file_path: bookingFilePath,
      content_type: '',
      size: 0,
      created_at: new Date().toISOString(),
      source: 'booking_request'
    }
  ] : [];

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="title">{t("crm.fullNameRequired")}</Label>
        <Input
          id="title"
          placeholder={t("crm.fullNamePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="number">{t("crm.phoneNumber")}</Label>
        <Input
          id="number"
          type="tel"
          placeholder={t("crm.phoneNumberPlaceholder")}
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialNetwork">{t("crm.socialLinkEmail")}</Label>
        <Input
          id="socialNetwork"
          type="email"
          placeholder={t("crm.socialLinkEmailPlaceholder")}
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
        />
      </div>

      {isEventBased && startDate && endDate && (
        <div className="rounded-md bg-muted p-3 space-y-2">
          <Label className="font-medium">{t("events.eventDetails")}</Label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">{t("events.start")}:</span>
              <div>{formatDateTime(startDate)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">{t("events.end")}:</span>
              <div>{formatDateTime(endDate)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="createEvent"
          checked={createEvent}
          onCheckedChange={(checked) => setCreateEvent(checked as boolean)}
          disabled={isEventBased} // Disable if the customer was created from an event
        />
        <Label
          htmlFor="createEvent"
          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed ${isEventBased ? "text-muted-foreground" : ""}`}
        >
          {isEventBased 
            ? t("crm.customerFromEvent") 
            : t("crm.createEventForCustomer")}
        </Label>
      </div>

      {createEvent && (
        <>
          <div className="space-y-2">
            <Label>{t("crm.paymentStatus")}</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("crm.selectPaymentStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
                <SelectItem value="partly">{t("crm.paidPartly")}</SelectItem>
                <SelectItem value="fully">{t("crm.paidFully")}</SelectItem>
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
                required={paymentStatus !== 'not_paid'}
              />
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">{t("crm.comment")}</Label>
        <Textarea
          id="notes"
          placeholder={t("crm.commentPlaceholder")}
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      {/* Display existing booking file if available */}
      {bookingFilePath && (
        <div className="space-y-2">
          <Label>{t("common.existingAttachment")}</Label>
          <FileDisplay 
            files={bookingFiles} 
            bucketName="event_attachments" 
            allowDelete={false}
            parentType="booking_request"
          />
        </div>
      )}

      <div className="space-y-2">
        <FileUploadField 
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
        />
      </div>
    </div>
  );
};
