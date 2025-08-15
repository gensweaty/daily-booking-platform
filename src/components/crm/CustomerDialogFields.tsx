import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { PaymentStatus } from "@/lib/types";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, ChevronUp, ChevronDown, RefreshCcw, User, UserCog, Calendar as CalendarClockIcon, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCurrencySymbol } from "@/lib/currency";
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
  displayedFiles?: FileRecord[];
  onFileDeleted?: (fileId: string) => void;
  eventStartDate: Date;
  setEventStartDate: (date: Date) => void;
  eventEndDate: Date;
  setEventEndDate: (date: Date) => void;
  fileBucketName?: string;
  fallbackBuckets?: string[];
  // Metadata props
  initialData?: any;
  // Permission props for sub-users
  currentUserName?: string;
  currentUserType?: string;
  isSubUser?: boolean;
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
  fileBucketName = "customer_attachments",
  fallbackBuckets = [],
  initialData,
  currentUserName,
  currentUserType = 'admin',
  isSubUser = false
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);
  
  // Show payment amount field if payment status is partly_paid or fully_paid
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";

  // Helper function to format date and time for display
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

    // Use the standardized payment status values
    const normalizedStatus = paymentStatus;
    
    let textColorClass = '';
    
    switch(normalizedStatus) {
      case 'fully_paid':
        textColorClass = 'text-green-600';
        break;
      case 'partly_paid':
        textColorClass = 'text-amber-600';
        break;
      default: // not_paid
        textColorClass = 'text-[#ea384c]';
        break;
    }

    // Display labels in user language
    const statusTextMap = {
      'not_paid': t('crm.notPaid'),
      'partly_paid': t('crm.paidPartly'),
      'fully_paid': t('crm.paidFully')
    };
    
    const text = statusTextMap[normalizedStatus as keyof typeof statusTextMap];
    
    return (
      <div className="mt-2 space-y-1">
        <Label>{t('crm.paymentDetails')}</Label>
        <div className={`font-medium ${textColorClass}`}>
          <LanguageText>
            {text}
          </LanguageText>
          {(normalizedStatus === 'partly_paid' || normalizedStatus === 'fully_paid') && paymentAmount && (
            <div className="text-xs mt-0.5">
              ({currencySymbol}{paymentAmount})
            </div>
          )}
        </div>
      </div>
    );
  };

  const formatDateDisplay = (date: Date) => {
    return format(date, 'MM/dd/yyyy HH:mm');
  };

  const renderMetadataIcon = (type: string | null) => {
    if (type === 'sub_user') {
      return <UserCog className="h-3 w-3" />;
    }
    return <User className="h-3 w-3" />;
  };

  const formatMetadataName = (name: string | null, type: string | null) => {
    if (!name) return 'Unknown';
    
    // Use the same logic as EventDialog - normalize the name properly
    if (name.includes('@')) {
      return name.split('@')[0];
    }
    return name || 'Unknown';
  };

  const formatMetadataDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString(language);
    } catch {
      return 'Invalid date';
    }
  };

  // Generate time options for hours selection grid - full 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return { value: hour, label: hour };
  });

  // Generate time options for minutes selection grid - all 60 minutes
  const minutes = Array.from({ length: 60 }, (_, i) => {
    const minute = i.toString().padStart(2, '0');
    return { value: minute, label: minute };
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="title">
          {isGeorgian ? (
            <GeorgianAuthText>სრული სახელი</GeorgianAuthText>
          ) : (
            <LanguageText>{t("crm.fullNameRequired")}</LanguageText>
          )}
        </Label>
        <Input
          id="title"
          placeholder={isGeorgian ? "შეიყვანეთ კლიენტის სრული სახელი" : t("crm.fullNamePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="number">
          {isGeorgian ? (
            <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText>
          ) : (
            <LanguageText>{t("crm.phoneNumber")}</LanguageText>
          )}
        </Label>
        <Input
          id="number"
          type="tel"
          placeholder={isGeorgian ? "შეიყვანეთ ტელეფონის ნომერი" : t("crm.phoneNumberPlaceholder")}
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
                  {isGeorgian ? (
                    <GeorgianAuthText>დაწყება</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("events.start")}</LanguageText>
                  )}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal"
                    >
                      {formatDateDisplay(eventStartDate)}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-0 bg-background" 
                    align="start"
                    sideOffset={4}
                  >
                    <div className="flex">
                      <div className="border-r">
                        <div className="flex items-center justify-between px-3 py-2 bg-muted">
                          <h4 className="font-medium text-sm">
                            {format(eventStartDate, 'MMMM yyyy')}
                          </h4>
                          <div className="flex items-center space-x-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 bg-background">
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-7 w-7 bg-background">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
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
                      </div>
                      <div className="flex">
                        <div className="grid auto-rows-max overflow-hidden">
                          <ScrollArea className="h-72 w-16">
                            <div className="flex flex-col items-center">
                              {hours.map((hour) => (
                                <div
                                  key={hour.value}
                                  className={cn(
                                    "flex items-center justify-center text-center h-10 w-full cursor-pointer hover:bg-muted",
                                    eventStartDate.getHours() === parseInt(hour.value) && "bg-primary text-primary-foreground"
                                  )}
                                  onClick={() => {
                                    const newDate = new Date(eventStartDate);
                                    newDate.setHours(parseInt(hour.value));
                                    setEventStartDate(newDate);
                                  }}
                                >
                                  {hour.label}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                        <div className="grid auto-rows-max overflow-hidden">
                          <ScrollArea className="h-72 w-16">
                            <div className="flex flex-col items-center">
                              {minutes.map((minute) => (
                                <div
                                  key={minute.value}
                                  className={cn(
                                    "flex items-center justify-center text-center h-10 w-full cursor-pointer hover:bg-muted",
                                    eventStartDate.getMinutes() === parseInt(minute.value) && "bg-primary text-primary-foreground"
                                  )}
                                  onClick={() => {
                                    const newDate = new Date(eventStartDate);
                                    newDate.setMinutes(parseInt(minute.value));
                                    setEventStartDate(newDate);
                                  }}
                                >
                                  {minute.label}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                  {isGeorgian ? (
                    <GeorgianAuthText>დასრულება</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("events.end")}</LanguageText>
                  )}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal"
                    >
                      {formatDateDisplay(eventEndDate)}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-0 bg-background" 
                    align="start"
                    sideOffset={4}
                  >
                    <div className="flex">
                      <div className="border-r">
                        <div className="flex items-center justify-between px-3 py-2 bg-muted">
                          <h4 className="font-medium text-sm">
                            {format(eventEndDate, 'MMMM yyyy')}
                          </h4>
                          <div className="flex items-center space-x-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 bg-background">
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-7 w-7 bg-background">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
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
                      </div>
                      <div className="flex">
                        <div className="grid auto-rows-max overflow-hidden">
                          <ScrollArea className="h-72 w-16">
                            <div className="flex flex-col items-center">
                              {hours.map((hour) => (
                                <div
                                  key={hour.value}
                                  className={cn(
                                    "flex items-center justify-center text-center h-10 w-full cursor-pointer hover:bg-muted",
                                    eventEndDate.getHours() === parseInt(hour.value) && "bg-primary text-primary-foreground"
                                  )}
                                  onClick={() => {
                                    const newDate = new Date(eventEndDate);
                                    newDate.setHours(parseInt(hour.value));
                                    setEventEndDate(newDate);
                                  }}
                                >
                                  {hour.label}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                        <div className="grid auto-rows-max overflow-hidden">
                          <ScrollArea className="h-72 w-16">
                            <div className="flex flex-col items-center">
                              {minutes.map((minute) => (
                                <div
                                  key={minute.value}
                                  className={cn(
                                    "flex items-center justify-center text-center h-10 w-full cursor-pointer hover:bg-muted",
                                    eventEndDate.getMinutes() === parseInt(minute.value) && "bg-primary text-primary-foreground"
                                  )}
                                  onClick={() => {
                                    const newDate = new Date(eventEndDate);
                                    newDate.setMinutes(parseInt(minute.value));
                                    setEventEndDate(newDate);
                                  }}
                                >
                                  {minute.label}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
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
              <SelectContent className="bg-background">
                <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
                <SelectItem value="partly_paid">{t("crm.paidPartly")}</SelectItem>
                <SelectItem value="fully_paid">{t("crm.paidFully")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showPaymentAmount && (
            <div className="space-y-2">
              <Label htmlFor="amount">
                {t("events.paymentAmount")} ({currencySymbol})
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder={`${t("events.paymentAmount")} (${currencySymbol})`}
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
            bucketName={fileBucketName}
            allowDelete
            onFileDeleted={onFileDeleted}
            parentType="customer"
            fallbackBuckets={fallbackBuckets}
            currentUserName={currentUserName}
            currentUserType={currentUserType}
            isSubUser={isSubUser}
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

      {/* Metadata display for created and updated info */}
      {initialData && (
        <div className="px-2 py-1 sm:px-3 sm:py-2 rounded-md border border-border bg-card text-card-foreground w-fit">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center">
              <CalendarClockIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="truncate">
                {t("common.created")} {format(new Date(initialData.created_at), 'MM/dd/yy HH:mm')}
                 {initialData.created_by_name && (
                    <span className="ml-1">
                      {language === 'ka' 
                        ? `${formatMetadataName(initialData.created_by_name, initialData.created_by_type)}-ს ${t("common.by")}` 
                        : `${t("common.by")} ${formatMetadataName(initialData.created_by_name, initialData.created_by_type)}`}
                    </span>
                  )}
              </span>
            </div>
            <div className="flex items-center">
              <History className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="truncate">
                {t("common.lastUpdated")} {format(new Date(initialData.updated_at || initialData.created_at), 'MM/dd/yy HH:mm')}
                 {initialData.last_edited_by_name && initialData.last_edited_at && (
                    <span className="ml-1">
                      {language === 'ka' 
                        ? `${formatMetadataName(initialData.last_edited_by_name, initialData.last_edited_by_type)}-ს ${t("common.by")}` 
                        : `${t("common.by")} ${formatMetadataName(initialData.last_edited_by_name, initialData.last_edited_by_type)}`}
                    </span>
                  )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
