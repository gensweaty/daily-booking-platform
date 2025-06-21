
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
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { getCurrencySymbol } from "@/lib/currency";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  isBookingRequest = false
}: EventDialogFieldsProps) => {
  const {
    t,
    language
  } = useLanguage();
  const [loading, setLoading] = useState(false);
  const isGeorgian = language === 'ka';
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";
  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";
  const currencySymbol = getCurrencySymbol(language);
  
  // Process files to remove duplicates by comparing path and name
  const processedFiles = useMemo(() => {
    if (!displayedFiles.length) return [];
    
    // Return the displayed files directly since deduplication is now handled in FileDisplay component
    return displayedFiles;
  }, [displayedFiles]);
  
  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;
  
  // Helper function for Georgian label text
  const renderGeorgianLabel = (text: string) => {
    if (isGeorgian) {
      if (text === "events.fullName") return <GeorgianAuthText letterSpacing="-0.05px">სრული სახელი</GeorgianAuthText>;
      if (text === "events.phoneNumber") return <GeorgianAuthText letterSpacing="-0.05px">ტელეფონის ნომერი</GeorgianAuthText>;
      if (text === "events.socialLinkEmail") return <GeorgianAuthText letterSpacing="-0.05px">ელფოსტა</GeorgianAuthText>; 
      if (text === "events.eventNotes") return <GeorgianAuthText letterSpacing="-0.05px">შენიშვნები</GeorgianAuthText>;
    }
    return <LanguageText>{t(text)}</LanguageText>;
  };
  
  // Fixed Georgian placeholder for event notes
  const getEventNotesPlaceholder = () => {
    if (isGeorgian) {
      return "დაამატეთ შენიშვნები თქვენი ჯავშნის შესახებ";
    }
    return t("events.addEventNotes");
  };
  
  return <>
      {/* Date and Time - Moved to top */}
      <div>
        <Label 
          htmlFor="dateTime" 
          className={cn(isGeorgian ? "font-georgian" : "")}
          style={georgianStyle}
        >
          <LanguageText>{t("events.dateAndTime")}</LanguageText>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label 
              htmlFor="startDate" 
              className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">დაწყება</GeorgianAuthText> : <LanguageText>{t("events.start")}</LanguageText>}
            </Label>
            <div className="relative">
              <Input 
                id="startDate" 
                type="datetime-local" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                required 
                className="w-full dark:text-white dark:[color-scheme:dark]" 
                style={{ colorScheme: 'auto' }} 
              />
            </div>
          </div>
          <div>
            <Label 
              htmlFor="endDate" 
              className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">დასრულება</GeorgianAuthText> : <LanguageText>{t("events.end")}</LanguageText>}
            </Label>
            <div className="relative">
              <Input 
                id="endDate" 
                type="datetime-local" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                required 
                className="w-full dark:text-white dark:[color-scheme:dark]" 
                style={{ colorScheme: 'auto' }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Person Data Section with Border */}
      <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
        <div className="mb-3">
          <h3 className={cn("text-sm font-medium text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">პირადი მონაცემები</GeorgianAuthText> : "Person Data"}
          </h3>
        </div>
        
        <div>
          <Label 
            htmlFor="userSurname" 
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={isGeorgian ? {
              fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
              letterSpacing: '-0.2px',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            } : undefined}
          >
            {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">სრული სახელი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
          </Label>
          <Input 
            id="userSurname" 
            value={userSurname} 
            onChange={e => {
              setUserSurname(e.target.value);
              setTitle(e.target.value); // Set title to same as userSurname
            }} 
            placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")} 
            required 
            className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
            style={isGeorgian ? {
              fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
              letterSpacing: '-0.2px',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            } : undefined} 
          />
        </div>
        
        <div>
          <Label 
            htmlFor="userNumber" 
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            {renderGeorgianLabel("events.phoneNumber")}
          </Label>
          <Input 
            id="userNumber" 
            value={userNumber} 
            onChange={e => setUserNumber(e.target.value)} 
            placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")} 
            className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}  
            style={georgianStyle} 
          />
        </div>
        
        <div>
          <Label 
            htmlFor="socialNetworkLink" 
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            {renderGeorgianLabel("events.socialLinkEmail")}
          </Label>
          <Input 
            id="socialNetworkLink" 
            value={socialNetworkLink} 
            onChange={e => setSocialNetworkLink(e.target.value)} 
            placeholder="email@example.com" 
            type="email" 
            style={isGeorgian ? { ...georgianStyle } : undefined}
          />
        </div>
        
        {!isBookingRequest && (
          <div>
            <Label 
              htmlFor="paymentStatus" 
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
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
        )}
        
        {!isBookingRequest && showPaymentAmount && (
          <div>
            <Label 
              htmlFor="paymentAmount" 
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              <LanguageText>{t("events.paymentAmount")}</LanguageText>
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-500">{currencySymbol}</span>
              </div>
              <Input 
                id="paymentAmount" 
                value={paymentAmount} 
                onChange={e => {
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
          <Label 
            htmlFor="eventNotes" 
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            {renderGeorgianLabel("events.eventNotes")}
          </Label>
          <Textarea 
            id="eventNotes" 
            value={eventNotes} 
            onChange={e => setEventNotes(e.target.value)} 
            placeholder={getEventNotesPlaceholder()}
            className={cn("min-h-[100px] resize-none", isGeorgian ? "placeholder:font-georgian font-georgian" : "")} 
            style={georgianStyle}
          />
        </div>
      </div>
      
      <div>
        <Label 
          htmlFor="file" 
          className={cn(isGeorgian ? "font-georgian" : "")}
          style={georgianStyle}
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
          <FileDisplay 
            files={processedFiles} 
            bucketName="event_attachments" 
            allowDelete={true} 
            onFileDeleted={onFileDeleted} 
            parentType="event" 
            parentId={eventId}
            fallbackBuckets={["customer_attachments", "booking_attachments"]} 
          />
        </div>
      )}
    </>;
};
