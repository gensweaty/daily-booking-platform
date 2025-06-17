
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface EventDialogFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  userSurname: string;
  setUserSurname: (surname: string) => void;
  userNumber: string;
  setUserNumber: (number: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (link: string) => void;
  eventNotes: string;
  setEventNotes: (notes: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  paymentStatus: string;
  setPaymentStatus: (status: string) => void;
  paymentAmount: string;
  setPaymentAmount: (amount: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  eventId?: string;
  onFileDeleted: (fileId: string) => void;
  displayedFiles: any[];
  isBookingRequest?: boolean;
  hideCustomerFields?: boolean;
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
  displayedFiles,
  isBookingRequest = false,
  hideCustomerFields = false
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  return (
    <div className="space-y-4">
      {/* Customer Information Fields - Hidden for group events */}
      {!hideCustomerFields && (
        <>
          <div>
            <Label htmlFor="user-surname" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.fullName")}
            </Label>
            <Input
              id="user-surname"
              value={userSurname}
              onChange={(e) => {
                setUserSurname(e.target.value);
                setTitle(e.target.value);
              }}
              placeholder={t("events.enterFullName")}
            />
          </div>

          <div>
            <Label htmlFor="user-number" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.phoneNumber")}
            </Label>
            <Input
              id="user-number"
              value={userNumber}
              onChange={(e) => setUserNumber(e.target.value)}
              placeholder={t("events.enterPhoneNumber")}
            />
          </div>

          <div>
            <Label htmlFor="social-network-link" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.emailOrSocial")}
            </Label>
            <Input
              id="social-network-link"
              value={socialNetworkLink}
              onChange={(e) => setSocialNetworkLink(e.target.value)}
              placeholder={t("events.enterEmailOrSocial")}
            />
          </div>
        </>
      )}

      {/* Date and Time Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start-date" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.startDate")}
          </Label>
          <Input
            id="start-date"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="end-date" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.endDate")}
          </Label>
          <Input
            id="end-date"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Payment Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment-status" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.paymentStatus")}
          </Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
              <SelectItem value="partly_paid">{t("events.partlyPaid")}</SelectItem>
              <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="payment-amount" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.paymentAmount")}
          </Label>
          <Input
            id="payment-amount"
            type="number"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder={t("events.enterAmount")}
          />
        </div>
      </div>

      {/* Event Notes */}
      <div>
        <Label htmlFor="event-notes" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.notes")}
        </Label>
        <Textarea
          id="event-notes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={t("events.enterNotes")}
          rows={3}
        />
      </div>

      {/* File Upload */}
      <FileUploadField
        selectedFile={selectedFile}
        onFileChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
      />

      {/* Display Files */}
      {displayedFiles.length > 0 && (
        <FileDisplay 
          files={displayedFiles}
          bucketName="event_attachments"
          allowDelete={true}
          onFileDeleted={onFileDeleted}
          parentId={eventId}
          parentType="event"
          fallbackBuckets={["customer_attachments", "booking_attachments"]}
        />
      )}
    </div>
  );
};
