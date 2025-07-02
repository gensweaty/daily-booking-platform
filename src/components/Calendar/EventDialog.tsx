import { useState, useEffect } from "react";
import { format, addYears, endOfYear } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { cn } from "@/lib/utils";
import { FileRecord } from "@/types/files";
import { EventDialogFields } from "./EventDialogFields";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { generateRecurringInstances, isVirtualInstance, getParentEventId, getInstanceDate } from "@/lib/recurringEvents";
import { sendBookingConfirmationEmail, sendBookingConfirmationToMultipleRecipients } from "@/lib/api";
import { Trash } from "lucide-react";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  event?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
  isBookingRequest?: boolean;
  onSave?: () => void;
}

interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

// Helper function to fetch event files
const fetchEventFiles = async (eventId: string): Promise<FileRecord[]> => {
  if (!eventId) return [];
  
  try {
    // For virtual instances, use the parent event ID
    const actualEventId = isVirtualInstance(eventId) ? getParentEventId(eventId) : eventId;
    console.log("Fetching files for event:", { originalId: eventId, actualId: actualEventId, isVirtual: isVirtualInstance(eventId) });
    
    const { data, error } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', actualEventId);

    if (error) {
      console.error('Error fetching event files:', error);
      return [];
    }

    console.log("Loaded files:", data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Error fetching event files:', error);
    return [];
  }
};

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  event,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
  isBookingRequest = false,
  onSave
}: EventDialogProps) => {
  
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayedFiles, setDisplayedFiles] = useState<FileRecord[]>([]);
  const [repeatPattern, setRepeatPattern] = useState("none");
  const [repeatUntil, setRepeatUntil] = useState<Date | undefined>(undefined);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showRegularDeleteConfirmation, setShowRegularDeleteConfirmation] = useState(false);
  
  // New state for additional persons management
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);

  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const isNewEvent = !event;

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Function to send email notifications for events
  const sendEventCreationEmail = async (eventData: any, additionalPersons: any[] = []) => {
    try {
      console.log(`🔔 Starting email notification process for event: ${eventData.title}`);
      
      // Get user's business profile for the email
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      console.log("📊 Business data for email:", businessData);
      
      if (!businessData) {
        console.warn("❌ Missing business data for event notification - skipping email");
        return;
      }

      // Collect all recipients (main attendee + additional persons)
      const recipients: Array<{ email: string; name: string }> = [];
      
      // Add main attendee if they have a valid email
      const mainAttendeeEmail = eventData.social_network_link;
      if (mainAttendeeEmail && isValidEmail(mainAttendeeEmail)) {
        recipients.push({
          email: mainAttendeeEmail,
          name: eventData.user_surname || eventData.title || ''
        });
      }
      
      // Add additional persons with valid emails
      if (additionalPersons && additionalPersons.length > 0) {
        additionalPersons.forEach(person => {
          if (person.socialNetworkLink && isValidEmail(person.socialNetworkLink)) {
            recipients.push({
              email: person.socialNetworkLink,
              name: person.userSurname || person.title || ''
            });
          }
        });
      }
      
      if (recipients.length === 0) {
        console.warn("❌ No valid email addresses found for sending notifications");
        return;
      }
      
      console.log(`📧 Found ${recipients.length} recipients for email notifications`);
      
      // Send emails to all recipients with 'event-creation' source
      if (recipients.length === 1) {
        const emailResult = await sendBookingConfirmationEmail(
          recipients[0].email,
          recipients[0].name,
          businessData.business_name || '',
          eventData.start_date,
          eventData.end_date,
          eventData.payment_status || 'not_paid',
          eventData.payment_amount || null,
          businessData.contact_address || '',
          eventData.id,
          'en',
          eventData.event_notes || '',
          'event-creation'
        );
        
        console.log("📧 Single email result:", emailResult);
        
        if (emailResult?.success) {
          console.log(`✅ Event creation email sent successfully to: ${recipients[0].email}`);
          toast({
            title: "Notification Sent",
            description: `Booking confirmation sent to ${recipients[0].email}`
          });
        } else {
          console.warn(`❌ Failed to send event creation email to ${recipients[0].email}:`, emailResult.error);
          toast({
            variant: "destructive",
            title: "Email Failed",
            description: `Failed to send confirmation to ${recipients[0].email}`
          });
        }
      } else {
        const emailResults = await sendBookingConfirmationToMultipleRecipients(
          recipients,
          businessData.business_name || '',
          eventData.start_date,
          eventData.end_date,
          eventData.payment_status || 'not_paid',
          eventData.payment_amount || null,
          businessData.contact_address || '',
          eventData.id,
          'en',
          eventData.event_notes || '',
          'event-creation'
        );
        
        console.log("📧 Multiple email results:", emailResults);
        
        if (emailResults.successful > 0) {
          console.log(`✅ Successfully sent ${emailResults.successful}/${emailResults.total} event creation emails`);
          toast({
            title: "Notifications Sent",
            description: `Booking confirmations sent to ${emailResults.successful} of ${emailResults.total} recipients`
          });
        }
        
        if (emailResults.failed > 0) {
          console.warn(`❌ Failed to send ${emailResults.failed}/${emailResults.total} event creation emails`);
          toast({
            variant: "destructive",
            title: "Some Emails Failed",
            description: `${emailResults.failed} email notifications failed to send`
          });
        }
      }
    } catch (error) {
      console.error("❌ Error sending event creation email:", error);
      toast({
        variant: "destructive",
        title: "Email Error",
        description: "Failed to send booking confirmation emails"
      });
    }
  };

  // Check if this is a recurring event that needs delete confirmation
  const isRecurringEvent = event && (event.is_recurring || isVirtualInstance(event.id));

  // Load additional persons for existing events
  const loadAdditionalPersons = async (eventId: string) => {
    if (!eventId) {
      setAdditionalPersons([]);
      return;
    }
    
    try {
      // For virtual instances, use the parent event ID
      const actualEventId = isVirtualInstance(eventId) ? getParentEventId(eventId) : eventId;
      console.log("Loading additional persons for event:", { originalId: eventId, actualId: actualEventId, isVirtual: isVirtualInstance(eventId) });
      
      // Use the new event_id foreign key relationship
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('event_id', actualEventId)
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
      } else {
        setAdditionalPersons([]);
      }
    } catch (err) {
      console.error("Exception loading additional persons:", err);
      setAdditionalPersons([]);
    }
  };

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (event) {
        // Editing existing event
        setTitle(event.title || "");
        setUserSurname(event.user_surname || "");
        setUserNumber(event.user_number || "");
        setSocialNetworkLink(event.social_network_link || "");
        setEventNotes(event.event_notes || "");
        setEventName(event.event_name || "");
        setStartDate(event.start_date ? format(new Date(event.start_date), "yyyy-MM-dd'T'HH:mm") : "");
        setEndDate(event.end_date ? format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm") : "");
        setPaymentStatus(event.payment_status || "not_paid");
        setPaymentAmount(event.payment_amount?.toString() || "");
        setRepeatPattern(event.repeat_pattern || "none");
        setRepeatUntil(event.repeat_until ? new Date(event.repeat_until) : undefined);
        
        // Load files and additional persons for existing event
        loadEventFiles(event.id);
        loadAdditionalPersons(event.id);
      } else {
        // Creating new event
        const now = selectedDate || new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const currentYearEnd = endOfYear(now);
        
        setTitle("");
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setEventName("");
        setStartDate(format(now, "yyyy-MM-dd'T'HH:mm"));
        setEndDate(format(oneHourLater, "yyyy-MM-dd'T'HH:mm"));
        setPaymentStatus("not_paid");
        setPaymentAmount("");
        setRepeatPattern("none");
        setRepeatUntil(currentYearEnd);
        setDisplayedFiles([]);
        setAdditionalPersons([]);
      }
      
      setSelectedFile(null);
      setFileError("");
      setShowDeleteConfirmation(false);
      setShowRegularDeleteConfirmation(false);
    }
  }, [open, event, selectedDate]);

  const loadEventFiles = async (eventId: string) => {
    if (!eventId) return;

    try {
      const files = await fetchEventFiles(eventId);
      console.log("Setting displayed files:", files.length);
      setDisplayedFiles(files);
    } catch (error) {
      console.error("Error loading event files:", error);
      setDisplayedFiles([]);
    }
  };

  const handleFileDeleted = (fileId: string) => {
    console.log("File deleted, removing from displayed files:", fileId);
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  // Functions to manage additional persons
  const addPerson = () => {
    if (additionalPersons.length >= 49) {
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

  const removePerson = (personId: string) => {
    setAdditionalPersons(prev => prev.filter(person => person.id !== personId));
  };

  const updatePerson = (personId: string, field: keyof PersonData, value: string) => {
    setAdditionalPersons(prev => 
      prev.map(person => 
        person.id === personId ? { ...person, [field]: value } : person
      )
    );
  };

  const validateForm = () => {
    if (!userSurname.trim()) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "სრული სახელი აუცილებელია" : "Full name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!startDate || !endDate) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error", 
        description: isGeorgian ? "დაწყების და დასრულების თარიღები აუცილებელია" : "Start and end dates are required",
        variant: "destructive",
      });
      return false;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "დასრულების თარიღი უნდა იყოს დაწყების თარიღის შემდეგ" : "End date must be after start date",
        variant: "destructive",
      });
      return false;
    }

    // Validate repeat until date
    if (repeatPattern !== "none" && repeatUntil && new Date(startDate) >= repeatUntil) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "განმეორების დასრულების თარიღი უნდა იყოს ღონისძიების დაწყების შემდეგ" : "Repeat until date must be after event start date",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // For virtual instances, always use the parent event ID for updates
      const actualEventId = event && isVirtualInstance(event.id) ? getParentEventId(event.id) : event?.id;
      console.log("Saving event:", { originalId: event?.id, actualId: actualEventId, isVirtual: event ? isVirtualInstance(event.id) : false });

      // Prepare event data
      const eventData = {
        title: userSurname,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName || null,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        payment_status: isBookingRequest ? "not_paid" : paymentStatus,
        payment_amount: paymentStatus === "not_paid" ? null : parseFloat(paymentAmount) || null,
        type: isBookingRequest ? 'booking_request' : 'event',
        is_recurring: repeatPattern !== "none",
        repeat_pattern: repeatPattern !== "none" ? repeatPattern : null,
        repeat_until: repeatPattern !== "none" && repeatUntil ? repeatUntil.toISOString() : null,
      };

      // Convert additional persons to JSONB format
      const additionalPersonsData = additionalPersons.map(person => ({
        userSurname: person.userSurname,
        userNumber: person.userNumber,
        socialNetworkLink: person.socialNetworkLink,
        eventNotes: person.eventNotes,
        paymentStatus: person.paymentStatus,
        paymentAmount: person.paymentAmount
      }));

      // Use the new database function for atomic operations
      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: eventData,
        p_additional_persons: additionalPersonsData,
        p_user_id: user.id,
        p_event_id: actualEventId || null
      });

      if (error) throw error;

      // Handle file upload if there's a selected file
      if (selectedFile && user) {
        // Use the correct event ID for file operations
        const eventIdForFiles = actualEventId || savedEventId;
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${eventIdForFiles}/${crypto.randomUUID()}.${fileExt}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error("File upload error:", uploadError);
          toast({
            title: isGeorgian ? "გაფრთხილება" : "Warning",
            description: isGeorgian ? "ფაილი ვერ აიტვირთა" : "File could not be uploaded",
            variant: "destructive",
          });
        } else {
          // Create file record in event_files table
          const fileData = {
            event_id: eventIdForFiles,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id,
          };

          const { error: insertError } = await supabase
            .from('event_files')
            .insert(fileData);

          if (insertError) {
            console.error('File record insert error:', insertError);
            toast({
              title: isGeorgian ? "გაფრთხილება" : "Warning",
              description: isGeorgian ? "ფაილის ჩანაწერი ვერ შეიქმნა" : "File record could not be created",
              variant: "destructive",
            });
          } else {
            console.log('✅ File uploaded and recorded successfully');
            
            // FIXED: Refresh files BEFORE closing the dialog
            if (eventIdForFiles) {
              try {
                const refreshedFiles = await fetchEventFiles(eventIdForFiles);
                console.log('📁 Refreshed files count:', refreshedFiles.length);
                setDisplayedFiles(refreshedFiles);
                // Clear selected file
                setSelectedFile(null);
              } catch (refreshError) {
                console.error('Error refreshing files:', refreshError);
              }
            }
          }
        }
      }

      // Send email notifications to all attendees BEFORE showing success message
      await sendEventCreationEmail(savedEventId, additionalPersonsData);

      toast({
        title: isGeorgian ? "წარმატება" : "Success",
        description: event 
          ? (isGeorgian ? "მოვლენა განახლდა" : "Event updated successfully")
          : (isGeorgian ? "მოვლენა შეიქმნა" : "Event created successfully"),
      });

      if (event) {
        onEventUpdated?.();
      } else {
        onEventCreated?.();
      }
      
      // FIXED: Close dialog AFTER file refresh is complete
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "მოვლენის შენახვისას მოხდა შეცდომა" : "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (isRecurringEvent) {
      setShowDeleteConfirmation(true);
    } else {
      setShowRegularDeleteConfirmation(true);
    }
  };

  const handleRegularDelete = async () => {
    if (!event) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: isGeorgian ? "წარმატება" : "Success",
        description: isGeorgian ? "მოვლენა წაიშალა" : "Event deleted successfully",
      });

      setShowRegularDeleteConfirmation(false);
      onEventDeleted?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "მოვლენის წაშლისას მოხდა შეცდომა" : "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (!event || !deleteChoice) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      console.log("🗑️ Deleting recurring event:", { 
        eventId: event.id, 
        deleteChoice, 
        isVirtual: isVirtualInstance(event.id),
        eventTitle: event.title || event.user_surname
      });

      if (isRecurringEvent && deleteChoice === "this") {
        // For "delete this event only", we need to create a deletion exception
        // This is a special record that tells the system to skip this particular date
        // when generating recurring instances
        
        const parentId = isVirtualInstance(event.id) ? getParentEventId(event.id) : event.id;
        const instanceDate = new Date(event.start_date);
        const instanceDateStr = format(instanceDate, 'yyyy-MM-dd');
        
        console.log("🚫 Creating deletion exception:", { 
          parentId, 
          instanceDate: instanceDateStr,
          eventTitle: event.title || event.user_surname
        });
        
        // Create a deletion exception record with a special structure
        // This record is NOT meant to be displayed as an event
        const exceptionData = {
          user_id: user.id,
          title: `__DELETED_${parentId}_${instanceDateStr}__`, // Special hidden marker
          start_date: instanceDate.toISOString(),
          end_date: new Date(event.end_date).toISOString(),
          type: 'deletion_exception', // Special type to identify deletion exceptions
          parent_event_id: parentId,
          event_notes: `Hidden deletion marker for ${instanceDateStr}`,
          is_recurring: false,
          // Mark this as a system record that should never be displayed
          user_surname: '__SYSTEM_DELETION_EXCEPTION__',
          user_number: '',
          social_network_link: '',
          payment_status: 'not_paid',
          payment_amount: null,
          // Add a special flag to make filtering easier
          deleted_at: null // This is NOT a deleted event, it's a deletion marker
        };
        
        const { error } = await supabase
          .from('events')
          .insert(exceptionData);
          
        if (error) {
          console.error("❌ Error creating deletion exception:", error);
          throw error;
        }
        
        console.log("✅ Deletion exception created successfully");
        
      } else if (deleteChoice === "series") {
        // Delete the entire series by marking the parent event as deleted
        const parentId = isVirtualInstance(event.id) ? getParentEventId(event.id) : event.id;
        console.log("🗑️ Deleting entire series:", parentId);
        
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', parentId);
          
        if (error) {
          console.error("❌ Error deleting series:", error);
          throw error;
        }
        
        console.log("✅ Series deleted successfully");
      }

      toast({
        title: isGeorgian ? "წარმატება" : "Success",
        description: isGeorgian ? "მოვლენა წაიშალა" : "Event deleted successfully",
      });

      setShowDeleteConfirmation(false);
      onEventDeleted?.();
      onOpenChange(false);
    } catch (error) {
      console.error("❌ Error deleting event:", error);
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "მოვლენის წაშლისას მოხდა შეცდომა" : "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {event 
                ? (isGeorgian ? <GeorgianAuthText>მოვლენის რედაქტირება</GeorgianAuthText> : <LanguageText>Edit Event</LanguageText>)
                : (isBookingRequest 
                  ? (isGeorgian ? <GeorgianAuthText>ჯავშნის მოთხოვნა</GeorgianAuthText> : <LanguageText>Booking Request</LanguageText>)
                  : (isGeorgian ? <GeorgianAuthText>ახალი მოვლენა</GeorgianAuthText> : <LanguageText>New Event</LanguageText>)
                )
              }
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <EventDialogFields
              title={title}
              setTitle={setTitle}
              userSurname={userSurname}
              setUserSurname={setUserSurname}
              userNumber={userNumber}
              setUserNumber={setUserNumber}
              socialNetworkLink={socialNetworkLink}
              setSocialNetworkLink={setSocialNetworkLink}
              eventNotes={eventNotes}
              setEventNotes={setEventNotes}
              eventName={eventName}
              setEventName={setEventName}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              paymentStatus={paymentStatus}
              setPaymentStatus={setPaymentStatus}
              paymentAmount={paymentAmount}
              setPaymentAmount={setPaymentAmount}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              eventId={event?.id}
              displayedFiles={displayedFiles}
              onFileDeleted={handleFileDeleted}
              isBookingRequest={isBookingRequest}
              repeatPattern={repeatPattern}
              setRepeatPattern={setRepeatPattern}
              repeatUntil={repeatUntil}
              setRepeatUntil={setRepeatUntil}
              isNewEvent={isNewEvent}
              additionalPersons={additionalPersons}
              onAddPerson={addPerson}
              onRemovePerson={removePerson}
              onUpdatePerson={updatePerson}
            />
            
            <div className="flex justify-between pt-4">
              <div>
                {event && !isBookingRequest && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={handleDeleteClick}
                    disabled={loading}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    style={georgianStyle}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  {isGeorgian ? <GeorgianAuthText>გაუქმება</GeorgianAuthText> : <LanguageText>{t("common.cancel")}</LanguageText>}
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  {loading 
                    ? (isGeorgian ? <GeorgianAuthText>მუშავდება...</GeorgianAuthText> : <LanguageText>{t("common.saving")}</LanguageText>)
                    : (event 
                      ? (isGeorgian ? <GeorgianAuthText>განახლება</GeorgianAuthText> : <LanguageText>{t("common.update")}</LanguageText>)
                      : (isGeorgian ? <GeorgianAuthText>შენახვა</GeorgianAuthText> : <LanguageText>{t("common.save")}</LanguageText>)
                    )
                  }
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Regular Delete Confirmation Dialog */}
      <AlertDialog open={showRegularDeleteConfirmation} onOpenChange={setShowRegularDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isGeorgian ? "მოვლენის წაშლა" : t("events.deleteEventConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isGeorgian 
                ? "ნამდვილად გსურთ ამ მოვლენის წაშლა? ეს მოქმედება შეუქცევადია." 
                : t("events.deleteEventConfirmMessage")
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowRegularDeleteConfirmation(false);
              }}
            >
              {isGeorgian ? "გაუქმება" : t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRegularDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isGeorgian ? "წაშლა" : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog for Recurring Events */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isGeorgian ? "განმეორადი მოვლენის წაშლა" : "Delete Recurring Event"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isGeorgian 
                ? "ეს მოვლენა განმეორადია. რას გსურთ?" 
                : "This is a recurring event. What would you like to do?"
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirmation(false);
              }}
            >
              {isGeorgian ? "გაუქმება" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete("this");
              }}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              {isGeorgian ? "მხოლოდ ეს მოვლენა" : "Delete this event only"}
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete("series");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isGeorgian ? "მთელი სერია" : "Delete entire series"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
