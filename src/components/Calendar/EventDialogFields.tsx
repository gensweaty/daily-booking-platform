
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
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Repeat, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { getRepeatOptions } from "@/lib/recurringEvents";
import { TaskDateTimePicker } from "@/components/tasks/TaskDateTimePicker";

// Define interface for person data
interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

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
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
  setExistingFiles: (files: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>) => void;
  eventId?: string;
  isBookingRequest?: boolean;
  // Add repeat props
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: string;
  setRepeatUntil: (value: string) => void;
  isNewEvent?: boolean;
  // New props for additional persons management
  additionalPersons: PersonData[];
  setAdditionalPersons: (persons: PersonData[]) => void;
  // Add missing prop
  isVirtualEvent?: boolean;
  // Add reminder props
  reminderTime: Date | null;
  setReminderTime: (date: Date | null) => void;
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
  files,
  setFiles,
  existingFiles,
  setExistingFiles,
  eventId,
  isBookingRequest = false,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  isNewEvent = false,
  additionalPersons,
  setAdditionalPersons,
  isVirtualEvent = false,
  reminderTime,
  setReminderTime
}: EventDialogFieldsProps) => {
  const {
    t,
    language
  } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isRepeatUntilPickerOpen, setIsRepeatUntilPickerOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const isGeorgian = language === 'ka';
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";
  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";
  const currencySymbol = getCurrencySymbol(language);
  
  // Show event name field only when there are multiple persons (additionalPersons.length > 0)
  const shouldShowEventNameField = additionalPersons.length > 0;

  // Generate repeat options using the dynamic function
  const repeatOptions = useMemo(() => {
    if (startDate) {
      return getRepeatOptions(new Date(startDate), t);
    }
    return getRepeatOptions(undefined, t);
  }, [startDate, t]);
  
  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  // Set reminderEnabled based on reminderTime
  useEffect(() => {
    setReminderEnabled(!!reminderTime);
  }, [reminderTime]);

  // Handle reminder enabled change
  const handleReminderEnabledChange = (enabled: boolean) => {
    setReminderEnabled(enabled);
    if (!enabled) {
      setReminderTime(null);
    }
  };

  // Handle reminder time selection
  const handleReminderTimeSelect = (date: Date) => {
    setReminderTime(date);
    setIsReminderPickerOpen(false);
  };
  
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

  // Handle recurring checkbox change with proper state management
  const handleRecurringToggle = (checked: boolean) => {
    console.log('Recurring toggle clicked:', checked);
    setIsRecurring(checked);
    if (!checked) {
      // Clear repeat settings when unchecked
      setRepeatPattern('');
      setRepeatUntil('');
    }
  };

  // Helper functions for additional persons management
  const onAddPerson = () => {
    const newPerson: PersonData = {
      id: crypto.randomUUID(),
      userSurname: '',
      userNumber: '',
      socialNetworkLink: '',
      eventNotes: '',
      paymentStatus: 'not_paid',
      paymentAmount: ''
    };
    setAdditionalPersons([...additionalPersons, newPerson]);
  };

  const onRemovePerson = (personId: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== personId));
  };

  const onUpdatePerson = (personId: string, field: keyof PersonData, value: string) => {
    setAdditionalPersons(additionalPersons.map(person => 
      person.id === personId ? { ...person, [field]: value } : person
    ));
  };

  // Handle existing file removal
  const handleRemoveExistingFile = async (fileId: string) => {
    try {
      // Remove from database
      const { error } = await supabase
        .from('event_files')
        .delete()
        .eq('id', fileId);

      if (error) {
        console.error('Error removing file:', error);
        return;
      }

      // Remove from UI
      setExistingFiles(existingFiles.filter(file => file.id !== fileId));
    } catch (error) {
      console.error('Error removing existing file:', error);
    }
  };

  // Function to render person data section
  const renderPersonSection = (
    person?: PersonData, 
    index?: number, 
    isMain: boolean = false
  ) => {
    const sectionUserSurname = isMain ? userSurname : (person?.userSurname || '');
    const sectionUserNumber = isMain ? userNumber : (person?.userNumber || '');
    const sectionSocialNetworkLink = isMain ? socialNetworkLink : (person?.socialNetworkLink || '');
    const sectionEventNotes = isMain ? eventNotes : (person?.eventNotes || '');
    
    // Fix payment status synchronization - use the main paymentStatus prop for main person
    const sectionPaymentStatus = isMain ? paymentStatus : (person?.paymentStatus || 'not_paid');
    const sectionPaymentAmount = isMain ? paymentAmount : (person?.paymentAmount || '');
    const sectionShowPaymentAmount = sectionPaymentStatus === "partly_paid" || sectionPaymentStatus === "fully_paid";

    const handleFieldChange = (field: string, value: string) => {
      if (isMain) {
        switch (field) {
          case 'userSurname':
            setUserSurname(value);
            setTitle(value);
            break;
          case 'userNumber':
            setUserNumber(value);
            break;
          case 'socialNetworkLink':
            setSocialNetworkLink(value);
            break;
          case 'eventNotes':
            setEventNotes(value);
            break;
          case 'paymentStatus':
            setPaymentStatus(value);
            break;
          case 'paymentAmount':
            setPaymentAmount(value);
            break;
        }
      } else if (person) {
        onUpdatePerson(person.id, field as keyof PersonData, value);
      }
    };

    return (
      <div key={isMain ? 'main' : person?.id} className="border rounded-lg p-4 space-y-4 bg-muted/20">
        <div className="mb-3 flex items-center justify-between">
          <h3 className={cn("text-sm font-medium text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText letterSpacing="-0.05px">
                {isMain ? "პირადი მონაცემები" : `პირი ${index! + 2}`}
              </GeorgianAuthText>
            ) : (
              isMain ? "Person Data" : `Person ${index! + 2}`
            )}
          </h3>
          {!isMain && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemovePerson(person!.id)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div>
          <Label 
            htmlFor={`userSurname-${isMain ? 'main' : person?.id}`}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">სრული სახელი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
          </Label>
          <Input 
            id={`userSurname-${isMain ? 'main' : person?.id}`}
            value={sectionUserSurname} 
            onChange={e => handleFieldChange('userSurname', e.target.value)} 
            placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")} 
            required={isMain}
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
            htmlFor={`userNumber-${isMain ? 'main' : person?.id}`}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            {renderGeorgianLabel("events.phoneNumber")}
          </Label>
          <Input 
            id={`userNumber-${isMain ? 'main' : person?.id}`}
            value={sectionUserNumber} 
            onChange={e => handleFieldChange('userNumber', e.target.value)} 
            placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")} 
            className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}  
            style={georgianStyle} 
          />
        </div>
        
        <div>
          <Label 
            htmlFor={`socialNetworkLink-${isMain ? 'main' : person?.id}`}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            {renderGeorgianLabel("events.socialLinkEmail")}
          </Label>
          <Input 
            id={`socialNetworkLink-${isMain ? 'main' : person?.id}`}
            value={sectionSocialNetworkLink} 
            onChange={e => handleFieldChange('socialNetworkLink', e.target.value)} 
            placeholder="email@example.com" 
            type="email" 
            style={isGeorgian ? { ...georgianStyle } : undefined}
          />
        </div>
        
        {!isBookingRequest && (
          <div>
            <Label 
              htmlFor={`paymentStatus-${isMain ? 'main' : person?.id}`}
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              <LanguageText>{t("events.paymentStatus")}</LanguageText>
            </Label>
            <Select value={sectionPaymentStatus} onValueChange={value => handleFieldChange('paymentStatus', value)}>
              <SelectTrigger id={`paymentStatus-${isMain ? 'main' : person?.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
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
        
        {!isBookingRequest && sectionShowPaymentAmount && (
          <div>
            <Label 
              htmlFor={`paymentAmount-${isMain ? 'main' : person?.id}`}
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
                id={`paymentAmount-${isMain ? 'main' : person?.id}`}
                value={sectionPaymentAmount} 
                onChange={e => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    handleFieldChange('paymentAmount', value);
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
            htmlFor={`eventNotes-${isMain ? 'main' : person?.id}`}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            {renderGeorgianLabel("events.eventNotes")}
          </Label>
          <Textarea 
            id={`eventNotes-${isMain ? 'main' : person?.id}`}
            value={sectionEventNotes} 
            onChange={e => handleFieldChange('eventNotes', e.target.value)} 
            placeholder={getEventNotesPlaceholder()}
            className={cn("min-h-[100px] resize-none", isGeorgian ? "placeholder:font-georgian font-georgian" : "")} 
            style={georgianStyle}
          />
        </div>
      </div>
    );
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

      {/* Repeat Options and Reminder - Only show for new events */}
      {isNewEvent && (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecurring"
                checked={isRecurring}
                onCheckedChange={handleRecurringToggle}
              />
              <Label 
                htmlFor="isRecurring" 
                className={cn("flex items-center gap-2", isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              >
                <Repeat className="h-4 w-4" />
                {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">განმეორება</GeorgianAuthText> : <LanguageText>Make this event recurring</LanguageText>}
              </Label>
            </div>

            <div className="flex items-center space-x-2 ml-4">
              <Checkbox
                id="reminderEnabled"
                checked={reminderEnabled}
                onCheckedChange={handleReminderEnabledChange}
              />
              <Label 
                htmlFor="reminderEnabled" 
                className={cn(isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              >
                {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">შეხსენების დაყენება</GeorgianAuthText> : <LanguageText>{t("events.setReminder")}</LanguageText>}
              </Label>
            </div>
          </div>

          {/* Reminder time picker */}
          {reminderEnabled && (
            <div>
              <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">შეხსენების დრო</GeorgianAuthText> : <LanguageText>Reminder Time</LanguageText>}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReminderPickerOpen(true)}
                  className="justify-start text-left font-normal"
                >
                  {reminderTime ? format(reminderTime, 'PPpp') : (isGeorgian ? 'აირჩიეთ დრო' : 'Pick reminder time')}
                </Button>
                {reminderTime && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReminderTime(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {isRecurring && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label 
                  htmlFor="repeatPattern" 
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">განმეორების რეჟიმი</GeorgianAuthText> : <LanguageText>Repeat</LanguageText>}
                </Label>
                <Select value={repeatPattern || ''} onValueChange={(value) => setRepeatPattern(value)}>
                  <SelectTrigger id="repeatPattern" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    <SelectValue placeholder={isGeorgian ? "აირჩიეთ..." : "Select..."} />
                  </SelectTrigger>
                  <SelectContent className={cn("bg-background", isGeorgian ? "font-georgian" : "")}>
                    {repeatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {repeatPattern && repeatPattern !== 'none' && (
                <div>
                  <Label 
                    htmlFor="repeatUntil" 
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    style={georgianStyle}
                  >
                    {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">განმეორება მდე</GeorgianAuthText> : <LanguageText>Repeat until</LanguageText>}
                  </Label>
                  <Popover open={isRepeatUntilPickerOpen} onOpenChange={setIsRepeatUntilPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !repeatUntil && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {repeatUntil ? format(new Date(repeatUntil), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={repeatUntil ? new Date(repeatUntil) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            // Ensure we only send the date part (YYYY-MM-DD) to fix biweekly issue
                            const dateStr = format(date, "yyyy-MM-dd");
                            setRepeatUntil(dateStr);
                            setIsRepeatUntilPickerOpen(false);
                          }
                        }}
                        disabled={(date) => {
                          if (!startDate) return false;
                          const startDateObj = new Date(startDate);
                          return date <= startDateObj;
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Person Data Section */}
      {renderPersonSection(undefined, undefined, true)}

      {/* Additional Persons */}
      {additionalPersons.map((person, index) => 
        renderPersonSection(person, index, false)
      )}

      {/* Add Person Button */}
      {additionalPersons.length < 49 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onAddPerson}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {isGeorgian ? (
              <GeorgianAuthText>პირის დამატება</GeorgianAuthText>
            ) : (
              <LanguageText>Add Person</LanguageText>
            )}
          </Button>
        </div>
      )}

      {/* Event Name Field - Moved to the end, only show when there are multiple persons */}
      {shouldShowEventNameField && (
        <div>
          <Label 
            htmlFor="eventName"
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={isGeorgian ? {
              fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
              letterSpacing: '-0.2px',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            } : undefined}
          >
            {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">მოვლენის სახელი</GeorgianAuthText> : <LanguageText>Event Name</LanguageText>}
          </Label>
          <Input 
            id="eventName"
            value={eventName} 
            onChange={e => setEventName(e.target.value)} 
            placeholder={isGeorgian ? "მოვლენის სახელი" : "Event Name"} 
            className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
            style={isGeorgian ? {
              fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
              letterSpacing: '-0.2px',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            } : undefined} 
          />
        </div>
      )}
      
      <div>
        <Label 
          htmlFor="file" 
          className={cn(isGeorgian ? "font-georgian" : "")}
          style={georgianStyle}
        >
          <LanguageText>{t("common.attachments")}</LanguageText>
        </Label>
        <FileUploadField 
          onChange={(file) => {
            if (file) {
              setFiles([...files, file]);
            }
          }} 
          fileError="" 
          setFileError={() => {}} 
          acceptedFileTypes={acceptedFormats} 
          selectedFile={null} 
          hideLabel={true} 
        />
      </div>
      
      {/* Show existing files with proper FileDisplay component */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>არსებული ფაილები</GeorgianAuthText> : "Existing Files:"}
          </div>
          <FileDisplay 
            files={existingFiles.map(file => ({
              id: file.id,
              filename: file.filename,
              file_path: file.file_path,
              content_type: file.content_type,
              size: file.size,
              created_at: new Date().toISOString(),
              user_id: '',
              source: 'event'
            } as FileRecord))}
            bucketName="event_attachments"
            allowDelete={true}
            onFileDeleted={handleRemoveExistingFile}
            parentType="event"
          />
        </div>
      )}

      {/* Show new files to be uploaded with proper FileDisplay component */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>ახალი ფაილები ატვირთვისთვის</GeorgianAuthText> : "New Files to Upload:"}
          </div>
          <FileDisplay 
            files={files.map((file, index) => ({
              id: `temp-${index}`,
              filename: file.name,
              file_path: '',
              content_type: file.type,
              size: file.size,
              created_at: new Date().toISOString(),
              user_id: '',
              source: 'event'
            } as FileRecord))}
            bucketName="event_attachments"
            allowDelete={true}
            onFileDeleted={(fileId) => {
              const index = parseInt(fileId.replace('temp-', ''));
              setFiles(files.filter((_, i) => i !== index));
            }}
            parentType="event"
          />
        </div>
      )}

      {/* Reminder Picker Dialog */}
      <TaskDateTimePicker
        isOpen={isReminderPickerOpen}
        onClose={() => setIsReminderPickerOpen(false)}
        onConfirm={handleReminderTimeSelect}
        initialDate={reminderTime || new Date()}
        title={isGeorgian ? "შეხსენების დროის არჩევა" : "Set Reminder Time"}
      />
    </>;
};
