import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { getRepeatOptions } from "@/lib/recurringEvents";

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
  eventName: string;
  setEventName: (value: string) => void;
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
  onFileDeleted: (fileId: string) => void;
  displayedFiles: any[];
  isBookingRequest?: boolean;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  isNewEvent: boolean;
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
  eventName,
  setEventName,
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
  repeatPattern,
  setRepeatPattern,
  isNewEvent,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  // State for repeat until date
  const [repeatUntilDate, setRepeatUntilDate] = useState<Date | undefined>();
  const [isRepeatUntilOpen, setIsRepeatUntilOpen] = useState(false);

  // Set default repeat until date to last day of current year
  useEffect(() => {
    if (!repeatUntilDate) {
      const currentYear = new Date().getFullYear();
      const lastDayOfYear = new Date(currentYear, 11, 31); // December 31st
      setRepeatUntilDate(lastDayOfYear);
    }
  }, []);

  // Get repeat options based on start date
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const repeatOptions = getRepeatOptions(startDateObj);

  return (
    <div className="space-y-4">
      {/* Full Name Field */}
      <div>
        <Label htmlFor="userSurname" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.fullName")}
        </Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => {
            setUserSurname(e.target.value);
            setTitle(e.target.value);
          }}
          placeholder={t("events.fullNamePlaceholder")}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* Phone Number Field */}
      <div>
        <Label htmlFor="userNumber" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.phoneNumber")}
        </Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder={t("events.phoneNumberPlaceholder")}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* Email/Social Link Field */}
      <div>
        <Label htmlFor="socialNetworkLink" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.emailOrSocial")}
        </Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder={t("events.emailOrSocialPlaceholder")}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* Event Name Field */}
      <div>
        <Label htmlFor="eventName" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.eventName")}
        </Label>
        <Input
          id="eventName"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder={t("events.eventNamePlaceholder")}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* Start Date Field */}
      <div>
        <Label htmlFor="startDate" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.startDate")}
        </Label>
        <Input
          id="startDate"
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* End Date Field */}
      <div>
        <Label htmlFor="endDate" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.endDate")}
        </Label>
        <Input
          id="endDate"
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* Repeat Pattern - Modified Layout */}
      {isNewEvent && (
        <div>
          <Label className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.repeat")}
          </Label>
          <div className="flex gap-2 mt-1">
            {/* Repeat Pattern Dropdown - Made smaller */}
            <div className="flex-1">
              <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                <SelectTrigger className={cn("w-full", isGeorgian ? "font-georgian" : "")}>
                  <SelectValue placeholder={t("events.selectRepeatPattern")} />
                </SelectTrigger>
                <SelectContent>
                  {repeatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Repeat Until Button - New */}
            {repeatPattern !== "none" && (
              <div className="flex-1">
                <Popover open={isRepeatUntilOpen} onOpenChange={setIsRepeatUntilOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !repeatUntilDate && "text-muted-foreground",
                        isGeorgian ? "font-georgian" : ""
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {repeatUntilDate ? format(repeatUntilDate, "PPP") : "Repeat until"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={repeatUntilDate}
                      onSelect={(date) => {
                        setRepeatUntilDate(date);
                        setIsRepeatUntilOpen(false);
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Status Field */}
      <div>
        <Label htmlFor="paymentStatus" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.paymentStatus")}
        </Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")}>
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
            <SelectItem value="partly_paid">{t("events.partlyPaid")}</SelectItem>
            <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment Amount Field */}
      <div>
        <Label htmlFor="paymentAmount" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.paymentAmount")}
        </Label>
        <Input
          id="paymentAmount"
          type="number"
          step="0.01"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
          placeholder={t("events.paymentAmountPlaceholder")}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* Notes Field */}
      <div>
        <Label htmlFor="eventNotes" className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("events.notes")}
        </Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={t("events.notesPlaceholder")}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* File Upload Section */}
      <FileUploadField
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
        isGeorgian={isGeorgian}
        t={t}
      />

      {/* Display Uploaded Files */}
      {displayedFiles.length > 0 && (
        <div>
          <Label className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.attachedFiles")}
          </Label>
          <div className="space-y-2 mt-2">
            {displayedFiles.map((file) => (
              <FileDisplay
                key={file.id}
                file={file}
                onDelete={onFileDeleted}
                isGeorgian={isGeorgian}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Additional Persons Section */}
      <div id="additional-persons-container">
        {/* This will be populated by the additional persons functionality */}
      </div>
    </div>
  );
};
