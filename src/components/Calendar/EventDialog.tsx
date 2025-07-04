import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EventDialogFields } from "./EventDialogFields";
import { useToast } from "@/hooks/use-toast";
import { sendEventCreationEmail } from "@/lib/api";

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
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [additionalPersons, setAdditionalPersons] = useState<Array<{
    id: string;
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>>([]);

  // Check if this is a recurring event (parent or child)
  const isRecurringEvent = initialData?.is_recurring || initialData?.parent_event_id;
  const isChildEvent = !!initialData?.parent_event_id;
  
  // Determine if this is creating a new event
  const isNewEvent = !eventId && !initialData;

  // Proper timezone-aware date formatting
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      
      // Convert to local timezone and format for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
      console.log("📅 Date formatting:", { input: dateStr, output: formatted });
      return formatted;
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  // Helper function to format date for repeat until (date only) - YYYY-MM-DD format
  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("Error formatting date only:", error);
      return "";
    }
  };

  // Convert datetime-local input to proper ISO string
  const convertInputDateToISO = (inputDate: string) => {
    if (!inputDate) return "";
    try {
      // Input format: "2025-07-11T21:00" (datetime-local)
      // Create date treating input as local time, then convert to UTC for database
      const [datePart, timePart] = inputDate.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      
      // Create date in local timezone
      const localDate = new Date(year, month - 1, day, hours, minutes);
      const isoString = localDate.toISOString();
      
      console.log("🔄 Converting input date:", { 
        input: inputDate, 
        localDate: localDate.toString(),
        iso: isoString 
      });
      return isoString;
    } catch (error) {
      console.error("Error converting input date to ISO:", error);
      return inputDate;
    }
  };

  // CRITICAL: Ensure repeat_until is YYYY-MM-DD format
  const formatRepeatUntil = (val: any) => {
    if (!val) return null;
    // Handles string with time or Date object
    if (typeof val === 'string') return val.slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return val;
  };

  useEffect(() => {
    if (open) {
      console.log("🔄 EventDialog opened with:", { eventId, initialData, selectedDate });
      
      if (initialData || eventId) {
        // Editing existing event - ensure proper date formatting
        const eventData = initialData;
        if (eventData) {
          console.log("📅 Loading existing event data:", eventData);
          
          setTitle(eventData.title || "");
          setUserSurname(eventData.user_surname || "");  
          setUserNumber(eventData.user_number || "");
          setSocialNetworkLink(eventData.social_network_link || "");
          setEventNotes(eventData.event_notes || "");
          setEventName(eventData.event_name || "");
          setPaymentStatus(eventData.payment_status || "");
          setPaymentAmount(eventData.payment_amount?.toString() || "");
          
          // Proper date formatting for existing events
          const formattedStartDate = formatDateForInput(eventData.start_date);
          const formattedEndDate = formatDateForInput(eventData.end_date);
          
          console.log("📅 Formatted dates:", { 
            original_start: eventData.start_date, 
            formatted_start: formattedStartDate,
            original_end: eventData.end_date,
            formatted_end: formattedEndDate
          });
          
          setStartDate(formattedStartDate);
          setEndDate(formattedEndDate);
          
          setIsRecurring(eventData.is_recurring || false);
          setRepeatPattern(eventData.repeat_pattern || "");
          
          // Format repeat_until for date input
          const formattedRepeatUntil = eventData.repeat_until ? formatDateOnly(eventData.repeat_until) : "";
          setRepeatUntil(formattedRepeatUntil);
          
          console.log("🔄 Recurring settings:", {
            is_recurring: eventData.is_recurring,
            repeat_pattern: eventData.repeat_pattern,
            repeat_until: eventData.repeat_until,
            formatted_repeat_until: formattedRepeatUntil
          });
        }
      } else if (selectedDate) {
        // Creating new event - proper timezone handling
        console.log("➕ Creating new event for date:", selectedDate);
        
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
        
        console.log("📅 New event times:", { 
          selectedDate: selectedDate.toISOString(),
          startDateTime,
          endDateTime: formatDateTime(endDateTime)
        });
        
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
        setRepeatPattern("");
        setRepeatUntil("");
        setAdditionalPersons([]);
        setFiles([]);
      }
    }
  }, [open, selectedDate, initialData, eventId]);

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
    setRepeatPattern("");
    setRepeatUntil("");
    setAdditionalPersons([]);
    setFiles([]);
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
      // Ensure proper date formatting and validation
      if (!startDate || !endDate) {
        throw new Error("Start date and end date are required");
      }

      // CRITICAL: Validate recurring event requirements
      if (isRecurring) {
        if (!repeatPattern || repeatPattern === 'none') {
          throw new Error("Select a repeat pattern!");
        }
        if (!repeatUntil) {
          throw new Error("Select a repeat until date!");
        }
        
        // Check that repeat_until > start_date
        const start = new Date(startDate);
        const until = new Date(formatRepeatUntil(repeatUntil));
        if (until <= start) {
          throw new Error("Repeat until must be after start date!");
        }
      }

      // Convert input dates to proper ISO format for database
      const startDateISO = convertInputDateToISO(startDate);
      const endDateISO = convertInputDateToISO(endDate);
      
      console.log("🚀 FINAL Date conversion for database:", {
        input_start: startDate,
        input_end: endDate,
        iso_start: startDateISO,
        iso_end: endDateISO,
        is_recurring: isRecurring,
        repeat_pattern: repeatPattern,
        repeat_until: repeatUntil
      });

      // CRITICAL: Properly format the payload with correct data types
      const payload = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: startDateISO,
        end_date: endDateISO,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        is_recurring: !!isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: isRecurring ? formatRepeatUntil(repeatUntil) : null,
      };

      console.log("🚀 FINAL payload being sent to database:", payload);

      let result;
      
      if (eventId || initialData) {
        // Update existing event
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: payload,
            p_additional_persons: additionalPersons,
            p_user_id: user.id,
            p_event_id: eventId || initialData?.id
          });
          
        if (result.error) throw result.error;
        
        toast({
          title: "Success",
          description: "Event updated successfully",
        });
        
        onEventUpdated?.();
      } else {
        // Create new event - this is where the recurring magic should happen
        console.log("🔄 Creating NEW EVENT with recurring settings:", {
          is_recurring: isRecurring,
          repeat_pattern: repeatPattern,
          repeat_until: repeatUntil,
          title: title
        });
        
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: payload,
            p_additional_persons: additionalPersons,
            p_user_id: user.id
          });

        if (result.error) {
          console.error("❌ Database function error:", result.error);
          throw result.error;
        }

        const newEventId = result.data;
        console.log("✅ Event created with ID:", newEventId);
        
        // Upload files for new event
        if (files.length > 0) {
          await uploadFiles(newEventId);
        }

        // Send email notification for new event creation
        console.log("🔔 Attempting to send event creation email for internal event");
        if (socialNetworkLink && socialNetworkLink.includes('@')) {
          try {
            const emailResult = await sendEventCreationEmail(
              socialNetworkLink,
              userSurname || title,
              "", // businessName will be resolved from user's business profile
              startDateISO,
              endDateISO,
              paymentStatus || null,
              paymentAmount ? parseFloat(paymentAmount) : null,
              "", // businessAddress will be resolved from user's business profile  
              newEventId,
              'en', // Default language
              eventNotes
            );
            
            if (emailResult.success) {
              console.log("✅ Event creation email sent successfully");
              toast({
                title: "Success",
                description: isRecurring ? 
                  "Recurring event series created and confirmation email sent!" :
                  "Event created and confirmation email sent!",
              });
            } else {
              console.error("❌ Failed to send event creation email:", emailResult.error);
              toast({
                title: "Event Created",
                description: isRecurring ?
                  "Recurring event series created successfully, but email notification failed to send." :
                  "Event created successfully, but email notification failed to send.",
              });
            }
          } catch (emailError) {
            console.error("❌ Error sending event creation email:", emailError);
            toast({
              title: "Event Created", 
              description: isRecurring ?
                "Recurring event series created successfully, but email notification failed to send." :
                "Event created successfully, but email notification failed to send.",
            });
          }
        } else {
          toast({
            title: "Success",
            description: isRecurring ?
              "Recurring event series created successfully" :
              "Event created successfully",
          });
        }
        
        onEventCreated?.();
      }

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error('❌ Error saving event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (!eventId && !initialData?.id) return;
    
    setIsLoading(true);
    
    try {
      if (isRecurringEvent && deleteChoice === "series") {
        // Delete entire series using the database function
        const { error } = await supabase.rpc('delete_recurring_series', {
          p_event_id: eventId || initialData?.id,
          p_user_id: user?.id,
          p_delete_choice: 'series'
        });
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Entire event series deleted successfully",
        });
      } else {
        // Delete single event
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
  const getRepeatUntilAsDate = (): Date => {
    if (repeatUntil) {
      return new Date(repeatUntil);
    }
    return new Date();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {eventId || initialData ? 
              `${isChildEvent ? "Edit Instance" : "Edit Event"}${isRecurringEvent ? " (Recurring)" : ""}` : 
              "Create New Event"
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
            repeatUntil={repeatUntil ? getRepeatUntilAsDate() : undefined}
            setRepeatUntil={handleRepeatUntilChange}
            files={files}
            setFiles={setFiles}
            additionalPersons={additionalPersons.map(person => ({
              ...person,
              id: person.id || crypto.randomUUID()
            }))}
            setAdditionalPersons={setAdditionalPersons}
            isNewEvent={isNewEvent}
          />

          <div className="flex justify-between">
            <div className="flex gap-2">
              {(eventId || initialData) && (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleDelete("this")}
                    disabled={isLoading}
                  >
                    Delete {isChildEvent ? "Instance" : "Event"}
                  </Button>
                  {isRecurringEvent && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDelete("series")}
                      disabled={isLoading}
                    >
                      Delete Series
                    </Button>
                  )}
                </>
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
                {isLoading ? "Saving..." : eventId || initialData ? "Update Event" : "Create Event"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
