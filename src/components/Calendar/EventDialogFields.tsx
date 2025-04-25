
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { cn } from "@/lib/utils";
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
  displayedFiles: FileRecord[];
  onFileDeleted: (fileId: string) => void;
  isBookingRequest?: boolean;
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
  displayedFiles,
  onFileDeleted,
  isBookingRequest = false,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const labelClass = cn("block font-medium", isGeorgian ? "font-georgian" : "");
  
  return (
    <>
      <div>
        <Label htmlFor="title" className={labelClass}>
          {t("events.title")}
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("events.title")}
          required
        />
      </div>
      <div>
        <Label htmlFor="userSurname" className={labelClass}>
          {t("events.fullName")}
        </Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
          placeholder={t("events.fullName")}
          required
        />
      </div>
      <div>
        <Label htmlFor="userNumber" className={labelClass}>
          {t("events.phoneNumber")}
        </Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder={t("events.phoneNumber")}
        />
      </div>
      <div>
        <Label htmlFor="socialNetworkLink" className={labelClass}>
          {t("events.socialLinkEmail")}
        </Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder="email@example.com"
          type="email"
        />
      </div>
      <div className={cn(isGeorgian ? "font-georgian" : "")}>
        <Label htmlFor="dateTime" className={labelClass}>
          {t("events.dateAndTime")}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
              {t("events.start")}
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
              {t("events.end")}
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>
      </div>
      
      {!isBookingRequest && (
        <>
          <div>
            <Label htmlFor="paymentStatus" className={labelClass}>
              {t("events.paymentStatus")}
            </Label>
            <Select
              value={paymentStatus}
              onValueChange={setPaymentStatus}
            >
              <SelectTrigger id="paymentStatus" className={isGeorgian ? "font-georgian" : ""}>
                <SelectValue placeholder={t("events.selectPaymentStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className={isGeorgian ? "font-georgian" : ""}>--</SelectItem>
                <SelectItem value="not_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.notPaid")}</SelectItem>
                <SelectItem value="partly_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.paidPartly")}</SelectItem>
                <SelectItem value="fully_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.paidFully")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="paymentAmount" className={labelClass}>
              {t("events.paymentAmount")}
            </Label>
            <Input
              id="paymentAmount"
              value={paymentAmount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setPaymentAmount(value);
                }
              }}
              placeholder="0.00"
              type="text"
              inputMode="decimal"
            />
          </div>
        </>
      )}
      
      <div>
        <Label htmlFor="eventNotes" className={labelClass}>
          {t("events.eventNotes")}
        </Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={t("events.addEventNotes")}
          className="min-h-[100px] resize-none"
        />
      </div>
      
      <div>
        <Label htmlFor="file" className={labelClass}>
          {t("common.attachments")}
        </Label>
        <FileUploadField
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
          acceptedFileTypes=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
      </div>
      
      {displayedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <FileDisplay
            files={displayedFiles}
            bucketName="event_attachments"
            allowDelete={true}
            onFileDeleted={onFileDeleted}
            parentType="event"
          />
        </div>
      )}
    </>
  );
};
