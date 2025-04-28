
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { Badge } from "@/components/ui/badge";
import { PaymentStatus } from "@/lib/types";
import { LanguageText } from "@/components/shared/LanguageText";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  customerId?: string;
  displayedFiles?: any[];
  onFileDeleted?: (fileId: string) => void;
  eventStartDate: Date;
  setEventStartDate: (date: Date) => void;
  eventEndDate: Date;
  setEventEndDate: (date: Date) => void;
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
  customerId,
  displayedFiles = [],
  onFileDeleted,
  eventStartDate,
  setEventStartDate,
  eventEndDate,
  setEventEndDate,
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();
  
  // Show payment amount field if payment status is partly paid or fully paid
  const showPaymentAmount = paymentStatus === "partly" || paymentStatus === "fully";

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

  // Function to format payment status display
  const renderPaymentStatus = () => {
    if (!isEventBased || !paymentStatus) return null;

    // Normalize payment status to handle both 'partly' and 'partly_paid' formats
    const normalizedStatus = 
      paymentStatus.includes('partly') ? 'partly' : 
      paymentStatus.includes('fully') ? 'fully' : 
      'not_paid';
    
    let textColorClass = '';
    
    switch(normalizedStatus) {
      case 'fully':
        textColorClass = 'text-green-600';
        break;
      case 'partly':
        textColorClass = 'text-amber-600';
        break;
      default: // not_paid
        textColorClass = 'text-[#ea384c]';
        break;
    }

    // Display labels in user language
    const statusTextMap = {
      'not_paid': t('crm.notPaid'),
      'partly': t('crm.paidPartly'),
      'fully': t('crm.paidFully')
    };
    
    const text = statusTextMap[normalizedStatus as keyof typeof statusTextMap];
    
    return (
      <div className="mt-2 space-y-1">
        <Label>{t('crm.paymentDetails')}</Label>
        <div className={`font-medium ${textColorClass}`}>
          <LanguageText>
            {text}
          </LanguageText>
          {(normalizedStatus === 'partly' || normalizedStatus === 'fully') && paymentAmount && (
            <div className="text-xs mt-0.5">
              ({language === 'es' ? '€' : '$'}{paymentAmount})
            </div>
          )}
        </div>
      </div>
    );
  };

  // Generate time options for the time picker (every 15 minutes)
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 8; hour <= 10; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        options.push({
          value: `${formattedHour}:${formattedMinute}`,
          label: `${formattedHour}:${formattedMinute}`
        });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  // Format display values for UI
  const formatTimeDisplay = (date: Date) => {
    return format(date, 'HH:mm');
  };

  const formatDateDisplay = (date: Date) => {
    return format(date, 'MM/dd/yyyy');
  };

  // Update time handlers
  const updateStartTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(eventStartDate);
    newDate.setHours(hours, minutes);
    setEventStartDate(newDate);
  };

  const updateEndTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(eventEndDate);
    newDate.setHours(hours, minutes);
    setEventEndDate(newDate);
  };

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
          
          {/* Payment status display for existing events */}
          {renderPaymentStatus()}
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
            <Label>{t("events.dateAndTime")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                  <LanguageText>{t("events.start")}</LanguageText>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !eventStartDate && "text-muted-foreground"
                      )}
                    >
                      <div className="flex-1 text-left">
                        {eventStartDate ? `${formatDateDisplay(eventStartDate)} ${formatTimeDisplay(eventStartDate)}` : "Select date"}
                      </div>
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={eventStartDate}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date);
                          newDate.setHours(eventStartDate.getHours(), eventStartDate.getMinutes());
                          setEventStartDate(newDate);
                        }
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                    <div className="grid grid-cols-3 gap-1 p-2 border-t">
                      {timeOptions.slice(0, 12).map((option) => (
                        <Button 
                          key={option.value}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => updateStartTime(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                  <LanguageText>{t("events.end")}</LanguageText>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !eventEndDate && "text-muted-foreground"
                      )}
                    >
                      <div className="flex-1 text-left">
                        {eventEndDate ? `${formatDateDisplay(eventEndDate)} ${formatTimeDisplay(eventEndDate)}` : "Select date"}
                      </div>
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={eventEndDate}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date);
                          newDate.setHours(eventEndDate.getHours(), eventEndDate.getMinutes());
                          setEventEndDate(newDate);
                        }
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                    <div className="grid grid-cols-3 gap-1 p-2 border-t">
                      {timeOptions.slice(0, 12).map((option) => (
                        <Button 
                          key={option.value}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => updateEndTime(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

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

          {showPaymentAmount && (
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
                required={showPaymentAmount}
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

      {customerId && displayedFiles && displayedFiles.length > 0 && (
        <div className="space-y-2">
          <FileDisplay 
            files={displayedFiles} 
            bucketName="customer_attachments"
            allowDelete
            onFileDeleted={onFileDeleted}
            parentType="customer"
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
