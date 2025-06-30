import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { cn } from "@/lib/utils";
import { FileRecord } from "@/types/files";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { getCurrencySymbol } from "@/lib/currency";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Repeat, Calendar as CalendarIcon } from "lucide-react";
import { getRepeatOptions } from "@/lib/recurringEvents";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

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
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  eventId?: string;
  displayedFiles: FileRecord[];
  onFileDeleted: (fileId: string) => void;
  isBookingRequest?: boolean;
  // Add repeat props
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: Date | undefined;
  setRepeatUntil: (date: Date | undefined) => void;
  isNewEvent?: boolean;
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
  displayedFiles,
  onFileDeleted,
  isBookingRequest = false,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  isNewEvent = false
}: EventDialogFieldsProps) => {
  const {
    t,
    language
  } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const isGeorgian = language === 'ka';
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";
  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";
  const currencySymbol = getCurrencySymbol(language);
  
  // State for additional persons
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  
  // Show event name field only when there are multiple persons (additionalPersons.length > 0)
  const shouldShowEventNameField = additionalPersons.length > 0;

  // Generate repeat options based on selected date and pass translation function
  const repeatOptions = useMemo(() => {
    const selectedDateTime = startDate ? new Date(startDate) : undefined;
    return getRepeatOptions(selectedDateTime, t);
  }, [startDate, t]);

  // Load additional persons when eventId changes - only load for specific events
  useEffect(() => {
    const loadAdditionalPersons = async () => {
      if (!eventId) {
        setAdditionalPersons([]);
        return;
      }
      
      try {
        console.log("Loading additional persons for specific event:", eventId);
        
        // Query customers table for additional persons linked to this specific event
        // We'll match by start_date, end_date, and user_id to find customers created for this event
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select('start_date, end_date, user_id')
          .eq('id', eventId)
          .single();
          
        if (eventError || !event) {
          console.error("Error loading event data:", eventError);
          setAdditionalPersons([]);
          return;
        }
        
        // Find customers that were created for this specific event time slot
        const { data: customers, error } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', event.user_id)
          .eq('start_date', event.start_date)
          .eq('end_date', event.end_date)
          .eq('type', 'customer')
          .order('created_at', { ascending: true });
          
        if (error) {
          console.error("Error loading additional persons:", error);
          return;
        }
        
        if (customers && customers.length > 0) {
          // Convert customers to PersonData format
          const personsData: PersonData[] = customers.map(customer => ({
            id: customer.id,
            userSurname: customer.user_surname || '',
            userNumber: customer.user_number || '',
            socialNetworkLink: customer.social_network_link || '',
            eventNotes: customer.event_notes || '',
            paymentStatus: customer.payment_status || 'not_paid',
            paymentAmount: customer.payment_amount?.toString() || ''
          }));
          
          console.log("Loaded additional persons for this event:", personsData.length);
          setAdditionalPersons(personsData);
        } else {
          setAdditionalPersons([]);
        }
      } catch (err) {
        console.error("Exception loading additional persons:", err);
        setAdditionalPersons([]);
      }
    };
    
    if (eventId) {
      loadAdditionalPersons();
    } else {
      // Clear additional persons when creating a new event
      setAdditionalPersons([]);
    }
  }, [eventId]);
  
  // Process files to remove duplicates by comparing path and name
  const processedFiles = useMemo(() => {
    if (!displayedFiles.length) return [];
    
    // Convert displayedFiles to FileRecord format if needed
    const fileRecords: FileRecord[] = displayedFiles.map(file => ({
      id: file.id,
      filename: file.filename,
      file_path: file.file_path,
      content_type: file.content_type || null,
      size: file.size || null,
      created_at: file.created_at || new Date().toISOString(),
      user_id: file.user_id || null,
      event_id: file.event_id || eventId || null,
      parentType: 'event'
    }));
    
    return fileRecords;
  }, [displayedFiles, eventId]);
  
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

  // Function to add a new person
  const addPerson = () => {
    if (additionalPersons.length >= 49) { // 49 + main person = 50 total
      return;
    }
    
    const newPerson: PersonData = {
      id: crypto.randomUUID(),
      userSurname: '',
      userNumber: '',
      socialNetworkLink: '',
      eventNotes: '',
      paymentStatus: 'not_paid',
      paymentAmount: ''
    };
    
    setAdditionalPersons(prev => [...prev, newPerson]);
  };

  // Function to remove a person
  const removePerson = (personId: string) => {
    setAdditionalPersons(prev => prev.filter(person => person.id !== personId));
  };

  // Function to update person data
  const updatePerson = (personId: string, field: keyof PersonData, value: string) => {
    setAdditionalPersons(prev => 
      prev.map(person => 
        person.id === personId ? { ...person, [field]: value } : person
      )
    );
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
        updatePerson(person.id, field as keyof PersonData, value);
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
              onClick={() => removePerson(person!.id)}
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

  // Expose additional persons data to parent component via a hidden field or callback
  useEffect(() => {
    // Store additional persons data in a way that can be accessed by parent
    (window as any).additionalPersonsData = additionalPersons;
  }, [additionalPersons]);
  
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

      {/* Repeat Options - Only show for new events */}
      {isNewEvent && (
        <div>
          <Label 
            htmlFor="repeatPattern" 
            className={cn("flex items-center gap-2 mb-2", isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            <Repeat className="h-4 w-4" />
            {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">განმეორება</GeorgianAuthText> : <LanguageText>{t("recurring.repeat")}</LanguageText>}
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                <SelectTrigger id="repeatPattern" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  <SelectValue placeholder={isGeorgian ? "განმეორების რეჟიმი" : t("recurring.doesNotRepeat")} />
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
            
            {repeatPattern !== "none" && (
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !repeatUntil && "text-muted-foreground",
                      isGeorgian ? "font-georgian" : ""
                    )}
                    style={georgianStyle}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {repeatUntil ? (
                      format(repeatUntil, "PPP")
                    ) : (
                      <span>
                        {isGeorgian ? (
                          <GeorgianAuthText letterSpacing="-0.05px">განმეორება მდე</GeorgianAuthText>
                        ) : (
                          <LanguageText>{t("recurring.repeatUntil")}</LanguageText>
                        )}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={repeatUntil}
                    onSelect={(date) => {
                      setRepeatUntil(date);
                      setIsDatePickerOpen(false);
                    }}
                    disabled={(date) => {
                      // Disable dates before the event start date
                      if (startDate) {
                        const eventStart = new Date(startDate);
                        return date < eventStart;
                      }
                      return date < new Date();
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
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
            onClick={addPerson}
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
            parentType="event"
            allowDelete={true} 
            onFileDeleted={onFileDeleted} 
            parentId={eventId}
          />
        </div>
      )}
    </>;
};
