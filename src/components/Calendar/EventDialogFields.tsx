
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { cn } from "@/lib/utils";
import { FileRecord } from "@/types/files";
import { LanguageText } from "@/components/shared/LanguageText";

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
  
  // Show payment amount if status is partly_paid/partly or fully_paid/fully
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid" || 
                           paymentStatus === "partly" || paymentStatus === "fully";
  
  // Log payment status for debugging
  console.log("EventDialogFields - Current payment status:", paymentStatus);
  console.log("EventDialogFields - Show payment amount field:", showPaymentAmount);
  console.log("EventDialogFields - Current payment amount:", paymentAmount);
  
  return (
    <>
      <div>
        <Label htmlFor="userSurname" className={labelClass}>
          <LanguageText>{t("events.fullName")}</LanguageText>
        </Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => {
            setUserSurname(e.target.value);
            setTitle(e.target.value); // Set title to same as userSurname
          }}
          placeholder={t("events.fullName")}
          required
        />
      </div>
      <div>
        <Label htmlFor="userNumber" className={labelClass}>
          <LanguageText>{t("events.phoneNumber")}</LanguageText>
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
          <LanguageText>{t("events.socialLinkEmail")}</LanguageText>
        </Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder="email@example.com"
          type="email"
        />
      </div>
      <div>
        <Label htmlFor="dateTime" className={labelClass}>
          <LanguageText>{t("events.dateAndTime")}</LanguageText>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
              <LanguageText>{t("events.start")}</LanguageText>
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
              <LanguageText>{t("events.end")}</LanguageText>
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
              <LanguageText>{t("events.paymentStatus")}</LanguageText>
            </Label>
            <Select
              value={paymentStatus}
              onValueChange={setPaymentStatus}
            >
              <SelectTrigger id="paymentStatus" className={isGeorgian ? "font-georgian" : ""}>
                <SelectValue placeholder={t("events.selectPaymentStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_paid" className={isGeorgian ? "font-georgian" : ""}><LanguageText>{t("crm.notPaid")}</LanguageText></SelectItem>
                <SelectItem value="partly_paid" className={isGeorgian ? "font-georgian" : ""}><LanguageText>{t("crm.paidPartly")}</LanguageText></SelectItem>
                <SelectItem value="fully_paid" className={isGeorgian ? "font-georgian" : ""}><LanguageText>{t("crm.paidFully")}</LanguageText></SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {showPaymentAmount && (
            <div>
              <Label htmlFor="paymentAmount" className={labelClass}>
                <LanguageText>{t("events.paymentAmount")}</LanguageText>
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
          )}
        </>
      )}
      
      <div>
        <Label htmlFor="eventNotes" className={labelClass}>
          <LanguageText>{t("events.eventNotes")}</LanguageText>
        </Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="min-h-[100px]"
          placeholder={isBookingRequest ? t("events.addBookingNotes") : t("events.addEventNotes")}
        />
      </div>
      
      {displayedFiles && displayedFiles.length > 0 && (
        <div>
          <Label className={labelClass}>
            <LanguageText>{t("events.attachments")}</LanguageText>
          </Label>
          <FileDisplay 
            files={displayedFiles} 
            bucketName="event_attachments"
            allowDelete={true}
            onFileDeleted={onFileDeleted}
            parentType="event" 
            parentId={eventId}
          />
        </div>
      )}

      <div>
        <Label className={labelClass}>
          <LanguageText>{t("events.uploadFile")}</LanguageText>
        </Label>
        <FileUploadField 
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
          bookingRequestId={isBookingRequest ? eventId : undefined}
        />
      </div>
    </>
  );
};
