import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { getCurrencySymbol } from "@/lib/currency";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo } from "react";
import { FileRecord } from "@/types/files";

interface CustomerDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  customerNotes: string;
  setCustomerNotes: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  createEvent: boolean;
  setCreateEvent: (value: boolean) => void;
  isEventBased?: boolean;
  startDate?: string;
  endDate?: string;
  customerId?: string | null;
  displayedFiles: any[];
  onFileDeleted: (fileId: string) => void;
  eventStartDate: Date;
  setEventStartDate: (date: Date) => void;
  eventEndDate: Date;
  setEventEndDate: (date: Date) => void;
  fileBucketName: string;
  fallbackBuckets: string[];
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
  customerNotes,
  setCustomerNotes,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  createEvent,
  setCreateEvent,
  isEventBased = false,
  startDate,
  endDate,
  customerId,
  displayedFiles,
  onFileDeleted,
  eventStartDate,
  setEventStartDate,
  eventEndDate,
  setEventEndDate,
  fileBucketName,
  fallbackBuckets
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";
  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";
  const currencySymbol = getCurrencySymbol(language);

  // Convert displayedFiles to FileRecord format
  const processedFiles = useMemo(() => {
    if (!displayedFiles.length) return [];
    
    const fileRecords: FileRecord[] = displayedFiles.map(file => ({
      id: file.id,
      filename: file.filename,
      file_path: file.file_path,
      content_type: file.content_type || null,
      size: file.size || null,
      created_at: file.created_at || new Date().toISOString(),
      user_id: file.user_id || null,
      event_id: file.event_id || null,
      customer_id: file.customer_id || customerId || null,
      parentType: isEventBased ? 'event' : 'customer'
    }));
    
    return fileRecords;
  }, [displayedFiles, customerId, isEventBased]);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  const renderGeorgianLabel = (text: string) => {
    if (isGeorgian) {
      if (text === "events.fullName") return <GeorgianAuthText letterSpacing="-0.05px">სრული სახელი</GeorgianAuthText>;
      if (text === "events.phoneNumber") return <GeorgianAuthText letterSpacing="-0.05px">ტელეფონის ნომერი</GeorgianAuthText>;
      if (text === "events.socialLinkEmail") return <GeorgianAuthText letterSpacing="-0.05px">ელფოსტა</GeorgianAuthText>;
      if (text === "events.eventNotes") return <GeorgianAuthText letterSpacing="-0.05px">შენიშვნები</GeorgianAuthText>;
      if (text === "crm.createEvent") return <GeorgianAuthText letterSpacing="-0.05px">ღონისძიების შექმნა</GeorgianAuthText>;
    }
    return <LanguageText>{t(text)}</LanguageText>;
  };

  const getEventNotesPlaceholder = () => {
    if (isGeorgian) {
      return "დაამატეთ შენიშვნები თქვენი ჯავშნის შესახებ";
    }
    return t("events.addEventNotes");
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {renderGeorgianLabel("events.fullName")}
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")}
          className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
          style={georgianStyle}
        />
      </div>

      <div>
        <Label htmlFor="userNumber" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {renderGeorgianLabel("events.phoneNumber")}
        </Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
          className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
          style={georgianStyle}
        />
      </div>

      <div>
        <Label htmlFor="socialNetworkLink" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {renderGeorgianLabel("events.socialLinkEmail")}
        </Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder="email@example.com"
          type="email"
          style={georgianStyle}
        />
      </div>

      <div>
        <Label htmlFor="customerNotes" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {renderGeorgianLabel("events.eventNotes")}
        </Label>
        <Textarea
          id="customerNotes"
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          placeholder={getEventNotesPlaceholder()}
          className={cn("min-h-[100px] resize-none", isGeorgian ? "placeholder:font-georgian font-georgian" : "")}
          style={georgianStyle}
        />
      </div>

      <div>
        <Label htmlFor="paymentStatus" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          <LanguageText>{t("events.paymentStatus")}</LanguageText>
        </Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger id="paymentStatus" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent className={cn("bg-background", isGeorgian ? "font-georgian" : "")}>
            <SelectItem value="not_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              <LanguageText>{t("crm.notPaid")}</LanguageText>
            </SelectItem>
            <SelectItem value="partly_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              <LanguageText>{t("crm.paidPartly")}</LanguageText>
            </SelectItem>
            <SelectItem value="fully_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              <LanguageText>{t("crm.paidFully")}</LanguageText>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showPaymentAmount && (
        <div>
          <Label htmlFor="paymentAmount" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            <LanguageText>{t("events.paymentAmount")}</LanguageText>
          </Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <span className="text-gray-500">{currencySymbol}</span>
            </div>
            <Input
              id="paymentAmount"
              value={paymentAmount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setPaymentAmount(value);
                }
              }}
              className="pl-7"
              placeholder="0.00"
              type="text"
              inputMode="decimal"
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="createEvent" className={cn("flex items-center space-x-2", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          <Checkbox
            id="createEvent"
            checked={createEvent}
            onCheckedChange={setCreateEvent}
          />
          {renderGeorgianLabel("crm.createEvent")}
        </Label>
      </div>

      {createEvent && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="eventStartDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">დაწყება</GeorgianAuthText> : <LanguageText>{t("events.start")}</LanguageText>}
            </Label>
            <Input
              id="eventStartDate"
              type="datetime-local"
              value={eventStartDate.toISOString().slice(0, 16)}
              onChange={(e) => setEventStartDate(new Date(e.target.value))}
              className="w-full dark:text-white dark:[color-scheme:dark]"
              style={{ colorScheme: 'auto' }}
            />
          </div>
          <div>
            <Label htmlFor="eventEndDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">დასრულება</GeorgianAuthText> : <LanguageText>{t("events.end")}</LanguageText>}
            </Label>
            <Input
              id="eventEndDate"
              type="datetime-local"
              value={eventEndDate.toISOString().slice(0, 16)}
              onChange={(e) => setEventEndDate(new Date(e.target.value))}
              className="w-full dark:text-white dark:[color-scheme:dark]"
              style={{ colorScheme: 'auto' }}
            />
          </div>
        </div>
      )}

      <div>
        <Label 
          htmlFor="file" 
          className={cn(isGeorgian ? "font-georgian" : "")}
          style={isGeorgian ? {
            fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
            letterSpacing: '-0.2px',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale'
          } : undefined}
        >
          <LanguageText>{t("common.attachments")}</LanguageText>
        </Label>
        <FileUploadField 
          onChange={setSelectedFile} 
          fileError={fileError} 
          setFileError={setFileError} 
          acceptedFileTypes={acceptedFormats} 
          selectedFile={selectedFile} 
          hideLabel={true} 
        />
      </div>
      
      {processedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <SimpleFileDisplay 
            files={processedFiles} 
            parentType={isEventBased ? 'event' : 'customer'}
            allowDelete={true} 
            onFileDeleted={onFileDeleted} 
            parentId={customerId}
          />
        </div>
      )}
    </div>
  );
};
