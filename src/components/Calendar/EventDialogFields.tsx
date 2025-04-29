import { FileDisplay } from "@/components/shared/FileDisplay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { CalendarEventType } from "@/lib/types/calendar";
import { Spinner } from "@/components/ui/spinner";
import { LanguageText } from "@/components/shared/LanguageText";
import { useEffect } from "react";
import { ensureEventAttachmentsBucket } from "@/integrations/supabase/checkStorage";

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
  onFileDeleted?: (fileId: string) => void;
  displayedFiles?: any[];
  isBookingRequest?: boolean;
  isLoading?: boolean;
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
  displayedFiles = [],
  isBookingRequest = false,
  isLoading = false
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const paymentStatusOptions = [
    { value: 'not_paid', label: t("events.notPaid") },
    { value: 'partly_paid', label: t("events.partlyPaid") },
    { value: 'fully_paid', label: t("events.fullyPaid") },
  ];
  
  // Ensure buckets exist and debug logs
  useEffect(() => {
    // Ensure required buckets exist when component mounts
    ensureEventAttachmentsBucket().catch(error => {
      console.error("Error ensuring event_attachments bucket exists:", error);
    });
    
    if (eventId) {
      console.log("EventDialogFields - eventId:", eventId);
      console.log("EventDialogFields - displayedFiles:", displayedFiles);
    }
  }, [eventId, displayedFiles]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    
    if (file.size > maxSize) {
      setFileError(t("events.fileTooLarge"));
      return;
    }
    
    setSelectedFile(file);
    setFileError("");
    console.log("File selected:", file.name, file.type, file.size);
  };

  // Handle sync between title and userSurname
  const handleFullNameChange = (value: string) => {
    setTitle(value);
    setUserSurname(value);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full-name" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.fullName")}
        </Label>
        <Input
          id="full-name"
          value={userSurname}
          onChange={(e) => handleFullNameChange(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="user-number" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.phoneNumber")}
        </Label>
        <Input
          id="user-number"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="social-link" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.emailSocialLink")}
        </Label>
        <Input
          id="social-link"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.start")}
          </Label>
          <Input
            id="start-date"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.end")}
          </Label>
          <Input
            id="end-date"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment-status" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.paymentStatus")}
        </Label>
        <Select 
          value={paymentStatus} 
          onValueChange={setPaymentStatus}
        >
          <SelectTrigger id="payment-status" className={cn(isGeorgian ? "font-georgian" : "")}>
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent>
            {paymentStatusOptions.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value}
                className={cn(isGeorgian ? "font-georgian" : "")}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {paymentStatus !== 'not_paid' && (
        <div className="space-y-2">
          <Label htmlFor="payment-amount" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.paymentAmount")}
          </Label>
          <Input
            id="payment-amount"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="event-notes" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.notes")}
        </Label>
        <Textarea
          id="event-notes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
          rows={4}
          placeholder={t("events.addNotes")}
        />
      </div>

      <div className="space-y-2">
        <Label className={cn(isGeorgian ? "font-georgian" : "")}>
          <LanguageText>{t("events.attachments")}</LanguageText>
        </Label>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-4 bg-muted/50 rounded-md">
            <Spinner size="sm" className="mr-2" /> 
            <span className="text-sm"><LanguageText>{t("common.loadingFiles")}</LanguageText></span>
          </div>
        ) : (
          <>
            {displayedFiles && displayedFiles.length > 0 ? (
              <FileDisplay 
                files={displayedFiles}
                onFileDeleted={onFileDeleted}
                showDelete={true}
                parentType={isBookingRequest ? "booking" : "event"}
                bucketName="event_attachments"
              />
            ) : (
              eventId && <div className="text-sm text-muted-foreground"><LanguageText>{t("common.noFiles")}</LanguageText></div>
            )}
          </>
        )}

        {/* File upload input */}
        <div className="mt-2">
          <Label htmlFor="attachment" className={cn("text-sm", isGeorgian ? "font-georgian" : "")}>
            <LanguageText>{t("events.attachment")}</LanguageText>
          </Label>
          <Input
            id="attachment"
            type="file"
            onChange={handleFileChange}
            className="mt-1"
          />
          {fileError && <p className="text-sm text-red-500 mt-1">{fileError}</p>}
        </div>
        <p className="text-xs text-muted-foreground mt-1" id="supportedFormats">
          <LanguageText>{t("events.supportedFormats")}</LanguageText>
        </p>
      </div>
    </div>
  );
};
