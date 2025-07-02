import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EventDialogFields } from "./EventDialogFields";
import { useToast } from "@/hooks/use-toast";
import { sendEventCreationEmail } from "@/lib/api";

// Helper function to format datetime for datetime-local input
const formatDatetimeLocal = (dt: string | Date | null | undefined): string => {
  if (!dt) return '';
  // Handles ISO strings or Date objects
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Helper function to format date for date input (repeat until)
const formatDateOnly = (dt: string | Date | null | undefined): string => {
  if (!dt) return '';
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  eventId?: string;
  initialData?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
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

interface ExistingFile {
  id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
}

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to collect all attendees with valid emails
const collectAttendeesWithEmails = (
  mainCustomerEmail: string,
  mainCustomerName: string,
  additionalPersons: PersonData[]
): Array<{ email: string; name: string }> => {
  const attendees: Array<{ email: string; name: string }> = [];
  
  // Add main customer if they have a valid email
  if (mainCustomerEmail && isValidEmail(mainCustomerEmail)) {
    attendees.push({
      email: mainCustomerEmail,
      name: mainCustomerName || ''
    });
  }
  
  // Add additional persons with valid emails
  if (additionalPersons && additionalPersons.length > 0) {
    additionalPersons.forEach(person => {
      if (person.socialNetworkLink && isValidEmail(person.socialNetworkLink)) {
        attendees.push({
          email: person.socialNetworkLink,
          name: person.userSurname || ''
        });
      }
    });
  }
  
  return attendees;
};

// Helper function to send emails to all attendees
const sendEmailsToAllAttendees = async (
  attendees: Array<{ email: string; name: string }>,
  eventData: any
) => {
  console.log(`🔔 Starting email notification process for ${attendees.length} attendees`);
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const attendee of attendees) {
    try {
      console.log(`📧 Sending email to: ${attendee.email} (${attendee.name})`);
      
      const emailResult = await sendEventCreationEmail(
        attendee.email,
        attendee.name,
        "", // businessName will be resolved from user's business profile
        eventData.start_date,
        eventData.end_date,
        eventData.payment_status || null,
        eventData.payment_amount ? parseFloat(eventData.payment_amount) : null,
        "", // businessAddress will be resolved from user's business profile  
        eventData.id,
        'en', // Default language
        eventData.event_notes
      );
      
      if (emailResult.success) {
        console.log(`✅ Email sent successfully to: ${attendee.email}`);
        successCount++;
      } else {
        console.error(`❌ Failed to send email to ${attendee.email}:`, emailResult.error);
        failureCount++;
      }
    } catch (emailError) {
      console.error(`❌ Error sending email to ${attendee.email}:`, emailError);
      failureCount++;
    }
  }
  
  return { successCount, failureCount, totalCount: attendees.length };
};

export const EventDialog = ({ 
  open, 
  onOpenChange, 
  selectedDate,
  eventId,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted
}: EventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventName, setEventName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("none");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Determine if this is a new event (not editing an existing one)
  const isNewEvent = !eventId && !initialData;
  
  // Check if this is a recurring event (parent or child)
  const isRecurringEvent = initialData?.is_recurring || !!initialData?.parent_event_id;

  // Combined useEffect for loading all event data - runs FIRST
  useEffect(() => {
    const loadEventData = async () => {
      if (!open) return;
      
      if (selectedDate && isNewEvent) {
        // Creating new event - set up defaults
        const formatDateTime = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        };

        const startDateTime = formatDateTime(selectedDate);
        const endDateTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);
        
        setStartDate(startDateTime);
        setEndDate(formatDateTime(endDateTime));
        
        // Reset all other fields for new event
        setTitle("");
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setEventName("");
        setPaymentStatus("");
        setPaymentAmount("");
        setIsRecurring(false);
        setRepeatPattern("none");
        setRepeatUntil("");
        setAdditionalPersons([]);
        setFiles([]);
        setExistingFiles([]);
        
      } else if ((eventId || initialData) && !isNewEvent && user) {
        // Editing existing event - load all data
        setDataLoading(true);
        const currentEventId = eventId || initialData?.id;
        if (!currentEventId) return;

        try {
          // Set main event data first
          if (initialData) {
            console.log("Setting initial data:", initialData);
            setTitle(initialData.title || "");
            setUserSurname(initialData.user_surname || "");  
            setUserNumber(initialData.user_number || "");
            setSocialNetworkLink(initialData.social_network_link || "");
            setEventNotes(initialData.event_notes || "");
            setEventName(initialData.event_name || "");
            setPaymentStatus(initialData.payment_status || "");
            setPaymentAmount(initialData.payment_amount?.toString() || "");
            setStartDate(formatDatetimeLocal(initialData.start_date));
            setEndDate(formatDatetimeLocal(initialData.end_date));
            setIsRecurring(initialData.is_recurring || false);
            setRepeatPattern(initialData.repeat_pattern || "none");
            setRepeatUntil(initialData.repeat_until ? formatDateOnly(initialData.repeat_until) : "");
            
            console.log("Set recurring state:", {
              isRecurring: initialData.is_recurring,
              repeatPattern: initialData.repeat_pattern,
              repeatUntil: initialData.repeat_until
            });
          }

          // Fetch additional persons
          const { data: personsData, error: personsError } = await supabase
            .from('customers')
            .select('*')
            .eq('event_id', currentEventId)
            .eq('user_id', user.id);

          if (personsError) {
            console.error('Error fetching additional persons:', personsError);
          } else if (personsData) {
            const mappedPersons: PersonData[] = personsData.map(person => ({
              id: person.id,
              userSurname: person.user_surname || '',
              userNumber: person.user_number || '',
              socialNetworkLink: person.social_network_link || '',
              eventNotes: person.event_notes || '',
              paymentStatus: person.payment_status || 'not_paid',
              paymentAmount: person.payment_amount?.toString() || ''
            }));
            console.log("Setting additional persons:", mappedPersons);
            setAdditionalPersons(mappedPersons);
          }

          // Fetch event files
          await fetchAndSetExistingFiles(currentEventId, user.id);
        } catch (error) {
          console.error('Error loading event data:', error);
        } finally {
          setDataLoading(false);
        }
      }
    };

    loadEventData();
  }, [open, selectedDate, eventId, initialData, isNewEvent, user]);

  const resetForm = () => {
    setTitle("");
    setUserSurname("");
    setUserNumber("");
    setSocialNetworkLink("");
    setEventNotes("");
    setEventName("");
    setPaymentStatus("");
    setPaymentAmount("");
    setStartDate("");
    setEndDate("");
    setIsRecurring(false);
    setRepeatPattern("none");
    setRepeatUntil("");
    setAdditionalPersons([]);
    setFiles([]);
    setExistingFiles([]);
  };

  const fetchAndSetExistingFiles = async (eventId: string, userId: string) => {
    const { data: filesData, error: filesError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId);
    if (filesError) {
      console.error('Error fetching event files:', filesError);
    } else {
      const mappedFiles: ExistingFile[] = (filesData || []).map(file => ({
        id: file.id,
        filename: file.filename,
        file_path: file.file_path,
        content_type: file.content_type || undefined,
        size: file.size || undefined
      }));
      setExistingFiles(mappedFiles);
    }
  };

  const uploadFiles = async (eventId: string) => {
    if (files.length === 0) return;

    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('event_attachments')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return null;
      }

      const { error: dbError } = await supabase
        .from('event_files')
        .insert({
          filename: file.name,
          file_path: fileName,
          content_type: file.type,
          size: file.size,
          user_id: user?.id,
          event_id: eventId
        });

      if (dbError) {
        console.error('Error saving file record:', dbError);
        return null;
      }

      return fileName;
    });

    await Promise.all(uploadPromises);
  };

  const removeExistingFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('event_files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error removing file:', error);
        toast({
          title: "Error",
          description: "Failed to remove file",
          variant: "destructive",
        });
        return;
      }

      setExistingFiles(prev => prev.filter(f => f.id !== fileId));
      toast({
        title: "Success",
        description: "File removed successfully",
      });
      
      // Re-fetch files to ensure sync
      if (eventId || initialData?.id) {
        await fetchAndSetExistingFiles(eventId || initialData?.id, user.id);
      }
    } catch (error) {
      console.error('Error removing file:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "User must be authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // STEP 2: Defensive Fix - Ensure title is never empty with proper fallback
      const eventTitle = (title || userSurname || "Untitled Event").trim();
      const safeUserSurname = (userSurname || eventTitle).trim();
      
      // STEP 2: Defensive Fix - Ensure repeat_until is always a string in YYYY-MM-DD format
      let safeRepeatUntil = null;
      if (isRecurring && repeatUntil) {
        if (typeof repeatUntil === "string") {
          safeRepeatUntil = repeatUntil;
        } else {
          safeRepeatUntil = repeatUntil.toISOString().slice(0, 10);
        }
      }

      // STEP 2: Defensive Fix - Ensure repeat_pattern is never "none" when recurring
      const safeRepeatPattern = isRecurring && repeatPattern !== "none" ? repeatPattern : null;
      
      const eventData = {
        title: eventTitle,
        user_surname: safeUserSurname,
        user_number: userNumber || "",
        social_network_link: socialNetworkLink || "",
        event_notes: eventNotes || "",
        event_name: eventName || "",
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus || "not_paid",
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        is_recurring: isRecurring,
        repeat_pattern: safeRepeatPattern,
        repeat_until: safeRepeatUntil,
      };

      // STEP 1: Debug logging - Log what we're about to send
      console.log('🔍 STEP 1 DEBUG - eventData:', eventData);
      console.log('🔍 STEP 1 DEBUG - additionalPersons:', additionalPersons);
      console.log('🔍 STEP 1 DEBUG - Recurring settings:', {
        isRecurring,
        repeatPattern,
        safeRepeatPattern,
        repeatUntil,
        safeRepeatUntil
      });

      // Frontend validation before sending
      if (isRecurring && !safeRepeatPattern) {
        toast({
          title: "Validation Error",
          description: "Please select a repeat pattern for recurring events",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (isRecurring && !safeRepeatUntil) {
        toast({
          title: "Validation Error", 
          description: "Please set an end date for recurring events",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      let result;
      
      if (eventId || initialData) {
        // Update existing event with JSON stringification
        console.log('🔍 STEP 1 DEBUG - Updating existing event with ID:', eventId || initialData?.id);
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: JSON.stringify(eventData),
            p_additional_persons: JSON.stringify(additionalPersons),
            p_user_id: user.id,
            p_event_id: eventId || initialData?.id
          });
          
        if (result.error) {
          console.error('🚨 STEP 3 DEBUG - RPC Error Details:', {
            error: result.error,
            message: result.error?.message,
            details: result.error?.details,
            hint: result.error?.hint,
            code: result.error?.code
          });
          throw result.error;
        }
        
        // Upload new files if any
        if (files.length > 0) {
          await uploadFiles(eventId || initialData?.id);
          await fetchAndSetExistingFiles(eventId || initialData?.id, user.id);
        }
        
        toast({
          title: "Success",
          description: "Event updated successfully",
        });
        
        onEventUpdated?.();
      } else {
        // Create new event with JSON stringification
        console.log('🔍 STEP 1 DEBUG - Creating new event');
        console.log('🔍 STEP 1 DEBUG - Final RPC payload:', {
          p_event_data: JSON.stringify(eventData),
          p_additional_persons: JSON.stringify(additionalPersons),
          p_user_id: user.id
        });
        
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: JSON.stringify(eventData),
            p_additional_persons: JSON.stringify(additionalPersons),
            p_user_id: user.id
          });

        if (result.error) {
          console.error('🚨 STEP 3 DEBUG - RPC Error Details:', {
            error: result.error,
            message: result.error?.message,
            details: result.error?.details,
            hint: result.error?.hint,
            code: result.error?.code
          });
          throw result.error;
        }

        const newEventId = result.data;
        console.log("✅ Event created with ID:", newEventId);
        
        // Upload files for new event
        if (files.length > 0) {
          await uploadFiles(newEventId);
          await fetchAndSetExistingFiles(newEventId, user.id);
        }

        // Enhanced email sending to all attendees
        console.log("🔔 Attempting to send event creation emails to all attendees");
        const attendees = collectAttendeesWithEmails(socialNetworkLink, safeUserSurname, additionalPersons);
        
        if (attendees.length > 0) {
          try {
            const emailResults = await sendEmailsToAllAttendees(attendees, {
              id: newEventId,
              title: eventTitle,
              user_surname: safeUserSurname,
              social_network_link: socialNetworkLink,
              start_date: startDate,
              end_date: endDate,
              payment_status: paymentStatus,
              payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
              event_notes: eventNotes
            });
            
            if (emailResults.successCount > 0) {
              console.log(`✅ Successfully sent ${emailResults.successCount}/${emailResults.totalCount} event creation emails`);
              
              // Show success message based on whether it's recurring
              const eventTypeMessage = isRecurring ? "recurring event series" : "event";
              toast({
                title: "Success",
                description: `${eventTypeMessage} created and confirmation emails sent to ${emailResults.successCount} attendee${emailResults.successCount > 1 ? 's' : ''}!`,
              });
            }
            
            if (emailResults.failureCount > 0) {
              console.warn(`❌ Failed to send ${emailResults.failureCount}/${emailResults.totalCount} event creation emails`);
              const eventTypeMessage = isRecurring ? "recurring event series" : "event";
              toast({
                title: emailResults.successCount > 0 ? "Partial Success" : "Event Created",
                description: emailResults.successCount > 0 
                  ? `${eventTypeMessage} created with ${emailResults.failureCount} email notification failures`
                  : `${eventTypeMessage} created successfully, but email notifications failed to send.`,
                variant: emailResults.successCount > 0 ? "default" : "destructive"
              });
            }
          } catch (emailError) {
            console.error("❌ Error sending event creation emails:", emailError);
            const eventTypeMessage = isRecurring ? "recurring event series" : "event";
            toast({
              title: "Event Created", 
              description: `${eventTypeMessage} created successfully, but email notifications failed to send.`,
            });
          }
        } else {
          const eventTypeMessage = isRecurring ? "recurring event series" : "event";
          toast({
            title: "Success",
            description: `${eventTypeMessage} created successfully`,
          });
        }
        
        onEventCreated?.();
      }

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      // STEP 3: Enhanced error logging with full details
      console.error('🚨 STEP 3 DEBUG - Complete Error Details:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        stack: error?.stack
      });
      
      // STEP 3: Show detailed error message to user
      let errorMessage = "Failed to save event";
      if (error?.message) {
        errorMessage = error.message;
      }
      if (error?.details) {
        errorMessage += " (" + error.details + ")";
      }
      if (error?.hint) {
        errorMessage += " Hint: " + error.hint;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!eventId && !initialData?.id) return;
    
    setIsLoading(true);
    
    try {
      if (isRecurringEvent) {
        // For recurring events, ask user what to delete
        const choice = window.confirm(
          "This is a recurring event. Click OK to delete the entire series, or Cancel to delete only this occurrence."
        );
        
        const deleteChoice = choice ? 'series' : 'this';
        
        const { data, error } = await supabase.rpc('delete_recurring_series', {
          p_event_id: eventId || initialData?.id,
          p_user_id: user?.id,
          p_delete_choice: deleteChoice
        });
        
        if (error) throw error;
        
        const deletedCount = data || 1;
        const message = deleteChoice === 'series' 
          ? `Deleted ${deletedCount} events from the series`
          : "Event deleted successfully";
        
        toast({
          title: "Success",
          description: message,
        });
      } else {
        // Single event deletion
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId || initialData?.id);
          
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Event deleted successfully",
        });
      }
      
      onEventDeleted?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to handle repeat until date changes
  const handleRepeatUntilChange = (date: Date) => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    setRepeatUntil(formatDate(date));
  };

  // Helper function to convert repeatUntil string to Date
  const getRepeatUntilAsDate = (): Date | undefined => {
    if (repeatUntil) {
      return new Date(repeatUntil);
    }
    return undefined;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {eventId || initialData ? "Edit Event" : "Create New Event"}
            {isRecurringEvent && (
              <span className="ml-2 text-sm text-muted-foreground">
                (Recurring Event)
              </span>
            )}
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
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={getRepeatUntilAsDate()}
            setRepeatUntil={handleRepeatUntilChange}
            files={files}
            setFiles={setFiles}
            existingFiles={existingFiles}
            onRemoveExistingFile={removeExistingFile}
            isNewEvent={isNewEvent}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            dataLoading={dataLoading}
          />

          <div className="flex justify-between">
            <div className="flex gap-2">
              {(eventId || initialData) && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  Delete Event{isRecurringEvent ? " / Series" : ""}
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  isRecurring ? "Creating Series..." : "Saving..."
                ) : (
                  eventId || initialData ? "Update Event" : "Create Event"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
