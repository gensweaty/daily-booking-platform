
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { LanguageText } from "@/components/shared/LanguageText";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  eventStart?: Date;
  setEventStart?: (date: Date) => void;
  eventEnd?: Date;
  setEventEnd?: (date: Date) => void;
  customerId?: string;
  displayedFiles?: any[];
  onFileDeleted?: (fileId: string) => void;
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
  eventStart,
  setEventStart,
  eventEnd,
  setEventEnd,
  customerId,
  displayedFiles = [],
  onFileDeleted,
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();
  
  // Check if we should show the payment amount field
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

  // Function to format date for display in input fields
  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return "";
    return format(date, "MM/dd/yyyy HH:mm");
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
          {/* Date and Time Selection - Styled like in Event Dialog */}
          <div className="space-y-2">
            <Label htmlFor="dateTime">{t("events.dateAndTime")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                  {t("events.start")}
                </Label>
                <div className="flex flex-col space-y-2">
                  <Input
                    id="startDate"
                    type="text"
                    value={eventStart ? formatDateForInput(eventStart) : ""}
                    readOnly
                    placeholder={t("events.selectDateTime")}
                    onClick={() => document.getElementById("startDateTrigger")?.click()}
                    className="cursor-pointer"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="startDateTrigger"
                        type="button"
                        variant="outline"
                        className="hidden"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventStart ? format(eventStart, "PPP") : t("events.selectDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800" align="start">
                      <div>
                        <Calendar
                          mode="single"
                          selected={eventStart}
                          onSelect={(date) => date && setEventStart && setEventStart(date)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                        <div className="grid grid-cols-4 gap-1 p-2 border-t dark:border-gray-700">
                          {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((hour) => (
                            <button
                              key={`hour-${hour}`}
                              type="button"
                              onClick={() => {
                                if (eventStart && setEventStart) {
                                  const newDate = new Date(eventStart);
                                  newDate.setHours(hour, 0, 0, 0);
                                  setEventStart(newDate);
                                }
                              }}
                              className="rounded hover:bg-gray-100 dark:hover:bg-gray-700 p-1 text-center text-sm"
                            >
                              {hour}:00
                            </button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                  {t("events.end")}
                </Label>
                <div className="flex flex-col space-y-2">
                  <Input
                    id="endDate"
                    type="text"
                    value={eventEnd ? formatDateForInput(eventEnd) : ""}
                    readOnly
                    placeholder={t("events.selectDateTime")}
                    onClick={() => document.getElementById("endDateTrigger")?.click()}
                    className="cursor-pointer"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="endDateTrigger"
                        type="button"
                        variant="outline"
                        className="hidden"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventEnd ? format(eventEnd, "PPP") : t("events.selectDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800" align="start">
                      <div>
                        <Calendar
                          mode="single"
                          selected={eventEnd}
                          onSelect={(date) => date && setEventEnd && setEventEnd(date)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                        <div className="grid grid-cols-4 gap-1 p-2 border-t dark:border-gray-700">
                          {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((hour) => (
                            <button
                              key={`hour-${hour}`}
                              type="button"
                              onClick={() => {
                                if (eventEnd && setEventEnd) {
                                  const newDate = new Date(eventEnd);
                                  newDate.setHours(hour, 0, 0, 0);
                                  setEventEnd(newDate);
                                }
                              }}
                              className="rounded hover:bg-gray-100 dark:hover:bg-gray-700 p-1 text-center text-sm"
                            >
                              {hour}:00
                            </button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
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
