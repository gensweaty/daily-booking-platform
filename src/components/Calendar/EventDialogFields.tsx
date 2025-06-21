
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
import { Plus, Trash2 } from "lucide-react";

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
  
  // State for additional persons
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  
  // Load additional persons when eventId changes
  useEffect(() => {
    const loadAdditionalPersons = async () => {
      if (!eventId) {
        setAdditionalPersons([]);
        return;
      }
      
      try {
        console.log("Loading additional persons for event:", eventId);
        
        // Query customers table for additional persons linked to this event
        const { data: customers, error } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
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
          
          console.log("Loaded additional persons:", personsData.length);
          setAdditionalPersons(personsData);
        }
      } catch (err) {
        console.error("Exception loading additional persons:", err);
      }
    };
    
    if (eventId) {
      loadAdditionalPersons();
    }
  }, [eventId]);
  
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
