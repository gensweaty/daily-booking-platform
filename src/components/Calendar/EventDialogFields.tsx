
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { PaymentStatus } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { FileRecord } from "@/types/files";
import { EventReminderFields } from "./EventReminderFields";

interface EventDialogFieldsProps {
  selectedDate: Date;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  eventNotes: string;
  setEventNotes: (value: string) => void;
  eventName: string;
  setEventName: (value: string) => void;
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
  reminderAt: Date | null;
  setReminderAt: (date: Date | null) => void;
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (enabled: boolean) => void;
}

export const EventDialogFields = ({
  selectedDate,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  eventNotes,
  setEventNotes,
  eventName,
  setEventName,
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
  reminderAt,
  setReminderAt,
  emailReminderEnabled,
  setEmailReminderEnabled,
}: EventDialogFieldsProps) => {
  const { t } = useLanguage();

  // Show payment amount field if payment status is partly_paid or fully_paid
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="surname">{t("events.fullName")}</Label>
        <Input
          id="surname"
          placeholder={t("events.fullNamePlaceholder")}
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="number">{t("events.phoneNumber")}</Label>
        <Input
          id="number"
          type="tel"
          placeholder={t("events.phoneNumberPlaceholder")}
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialNetwork">{t("events.socialLinkEmail")}</Label>
        <Input
          id="socialNetwork"
          type="email"
          placeholder={t("events.socialLinkEmailPlaceholder")}
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventName">{t("events.eventName")}</Label>
        <Input
          id="eventName"
          placeholder={t("events.eventNamePlaceholder")}
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("events.paymentStatus")}</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger>
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
            <SelectItem value="partly_paid">{t("events.partlyPaid")}</SelectItem>
            <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showPaymentAmount && (
        <div className="space-y-2">
          <Label htmlFor="amount">{t("events.paymentAmount")}</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder={t("events.paymentAmount")}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required={showPaymentAmount}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">{t("events.eventNotes")}</Label>
        <Textarea
          id="notes"
          placeholder={t("events.eventNotesPlaceholder")}
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      <EventReminderFields
        reminderAt={reminderAt}
        setReminderAt={setReminderAt}
        emailReminderEnabled={emailReminderEnabled}
        setEmailReminderEnabled={setEmailReminderEnabled}
      />

      {eventId && displayedFiles && displayedFiles.length > 0 && (
        <div className="space-y-2">
          <FileDisplay 
            files={displayedFiles} 
            bucketName="event_attachments"
            allowDelete
            onFileDeleted={onFileDeleted}
            parentType="event"
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
