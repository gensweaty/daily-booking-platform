import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { getCurrencySymbol } from "@/lib/currency";
import { CalendarEventType } from "@/lib/types/calendar"; 
import { FileRecord } from "@/types/files";

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
  displayedFiles?: FileRecord[];
  onFileDeleted?: (fileId: string) => void;
  isBookingRequest?: boolean;
  fileBucketName?: string;
  fallbackBuckets?: string[];
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
  displayedFiles = [],
  onFileDeleted,
  isBookingRequest = false,
  fileBucketName = "event_attachments",
  fallbackBuckets = []
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const currencySymbol = getCurrencySymbol(language);
  const isGeorgian = language === 'ka';
  
  // Show payment amount field if payment status is partly paid or fully paid
  const showPaymentAmount = paymentStatus.includes('partly') || paymentStatus.includes('fully');
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">
          {isGeorgian ? "სრული სახელი" : t("crm.fullNameRequired")}
        </Label>
        <Input
          id="title"
          placeholder={isGeorgian ? "შეიყვანეთ კლიენტის სრული სახელი" : t("crm.fullNamePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="number">
          {isGeorgian ? "ტელეფონის ნომერი" : t("crm.phoneNumber")}
        </Label>
        <Input
          id="number"
          type="tel"
          placeholder={isGeorgian ? "შეიყვანეთ ტელეფონის ნომერი" : t("crm.phoneNumberPlaceholder")}
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

      <div className="space-y-2">
        <Label htmlFor="startDate">{t("events.startDate")}</Label>
        <Input
          id="startDate"
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">{t("events.endDate")}</Label>
        <Input
          id="endDate"
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("crm.paymentStatus")}</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("crm.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
            <SelectItem value="partly">{t("crm.paidPartly")}</SelectItem>
            <SelectItem value="fully">{t("crm.paidFully")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showPaymentAmount && (
        <div className="space-y-2">
          <Label htmlFor="amount">
            {t("events.paymentAmount")} ({currencySymbol})
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder={`${t("events.paymentAmount")} (${currencySymbol})`}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required={showPaymentAmount}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">{t("crm.comment")}</Label>
        <Textarea
          id="notes"
          placeholder={t("crm.commentPlaceholder")}
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>
      
      {eventId && displayedFiles.length > 0 && (
        <div className="space-y-2">
          <FileDisplay 
            files={displayedFiles} 
            bucketName={fileBucketName}
            allowDelete 
            onFileDeleted={onFileDeleted}
            parentType="event"
            fallbackBuckets={fallbackBuckets}
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

export default EventDialogFields;
