
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EventDialogFields } from "./EventDialogFields";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { sendEventCreationEmail } from "@/lib/api";
import { isVirtualInstance, getParentEventId, getInstanceDate } from "@/lib/recurringEvents";

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

// Helper function to convert datetime-local input values to ISO string in local timezone
const localDateTimeToISOString = (dtStr: string): string => {
  if (!dtStr) return new Date().toISOString();
  
  const [datePart, timePart] = dtStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  // Create date in local timezone
  const localDate = new Date(year, month - 1, day, hour, minute);
  return localDate.toISOString();
};

// Helper function to convert ISO string from DB to datetime-local input format
const isoToLocalDateTimeInput = (isoString: string): string => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
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

  const isNewEvent = !initialData && !eventId;
  const isVirtualEvent = eventId ? isVirtualInstance(eventId) : false;
  // Fix: Check BOTH database is_recurring flag AND virtual instance status
  const isRecurringEvent = initialData?.is_recurring || isVirtualEvent || isRecurring;

  // Load existing files for the event
  const loadExistingFiles = async (targetEventId: string) => {
    try {
      const { data: eventFiles, error } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', targetEventId);

      if (error) {
        console.error('Error loading event files:', error);
        return;
      }

      setExistingFiles(eventFiles || []);
    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  };

  useEffect(() => {
    if (open) {
      if (initialData || eventId) {
        // Load existing files
        const targetEventId = eventId || initialData?.id;
        if (targetEventId) {
          loadExistingFiles(targetEventId);
        }

        // For virtual instances, we need to load parent event data for recurrence info
        if (isVirtualEvent && eventId) {
          const parentId = getParentEventId(eventId);
          // Load parent event for recurrence settings
          loadParentEventData(parentId);
        }
        
        // Set current event data
        const eventData = initialData;
        if (eventData) {
          setTitle(eventData.title || "");
          setUserSurname(eventData.user_surname || "");  
          setUserNumber(eventData.user_number || "");
          setSocialNetworkLink(eventData.social_network_link || "");
          setEventNotes(eventData.event_notes || "");
          setEventName(eventData.event_name || "");
          setPaymentStatus(eventData.payment_status || "");
          setPaymentAmount(eventData.payment_amount?.toString() || "");
          
          // Handle date synchronization for virtual instances with proper timezone conversion
          if (isVirtualEvent && eventId) {
            const instanceDate = getInstanceDate(eventId);
            if (instanceDate && eventData) {
              const baseStart = new Date(eventData.start_date);
              const baseEnd = new Date(eventData.end_date);
              
              const [year, month, day] = instanceDate.split('-');
              const newStart = new Date(baseStart);
              newStart.setFullYear(+year, +month - 1, +day);
              const newEnd = new Date(baseEnd);
              newEnd.setFullYear(+year, +month - 1, +day);
              
              // Use proper timezone conversion
              setStartDate(isoToLocalDateTimeInput(newStart.toISOString()));
              setEndDate(isoToLocalDateTimeInput(newEnd.toISOString()));
            } else {
              // Use proper timezone conversion for regular dates
              setStartDate(isoToLocalDateTimeInput(eventData.start_date));
              setEndDate(isoToLocalDateTimeInput(eventData.end_date));
            }
          } else {
            // Use proper timezone conversion for all date inputs
            setStartDate(isoToLocalDateTimeInput(eventData.start_date));
            setEndDate(isoToLocalDateTimeInput(eventData.end_date));
          }
          
          // Fix: Always load recurrence settings, not just for non-virtual events
          setIsRecurring(eventData.is_recurring || false);
          setRepeatPattern(eventData.repeat_pattern || "");
          setRepeatUntil(eventData.repeat_until || "");
        }
      } else if (selectedDate) {
        // Creating new event - use proper timezone conversion
        const startDateTime = isoToLocalDateTimeInput(selectedDate.toISOString());
        const endDateTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);
        
        setStartDate(startDateTime);
        setEndDate(isoToLocalDateTimeInput(endDateTime.toISOString()));
        
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
        setExistingFiles([]);
      }
    }
  }, [open, selectedDate, initialData, eventId, isVirtualEvent]);

  const loadParentEventData = async (parentId: string) => {
    try {
      const { data: parentEvent, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', parentId)
        .single();

      if (error) throw error;

      if (parentEvent) {
        setIsRecurring(parentEvent.is_recurring || false);
        setRepeatPattern(parentEvent.repeat_pattern || "");
        setRepeatUntil(parentEvent.repeat_until || "");
      }
    } catch (error) {
      console.error('Error loading parent event:', error);
    }
  };

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
    setExistingFiles([]);
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

    // Fix: Validate recurring event data for BOTH new and existing events
    if (isRecurring) {
      if (!repeatPattern || !repeatUntil) {
        toast({
          title: "Error",
          description: "Please select a repeat pattern and end date for recurring events",
          variant: "destructive",
        });
        return;
      }

      const startDateObj = new Date(localDateTimeToISOString(startDate));
      const repeatUntilObj = new Date(repeatUntil);
      
      if (repeatUntilObj <= startDateObj) {
        toast({
          title: "Error", 
          description: "Repeat until date must be after the event start date",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      // Enhanced debug logging for repeat pattern
      console.log("🔄 Event creation debug:", {
        isRecurring,
        repeatPattern,
        repeatUntil,
        startDate,
        endDate,
        isNewEvent,
        startDateConverted: localDateTimeToISOString(startDate),
        endDateConverted: localDateTimeToISOString(endDate)
      });

      const eventData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: localDateTimeToISOString(startDate), // Convert to proper ISO string
        end_date: localDateTimeToISOString(endDate), // Convert to proper ISO string
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        // Fix: Always send recurring data if it's set, regardless of isNewEvent
        is_recurring: isRecurring,
        repeat_pattern: (isRecurring && repeatPattern) ? repeatPattern : null,
        repeat_until: (isRecurring && repeatUntil) ? repeatUntil : null,
      };

      console.log("📤 Sending event data to backend:", eventData);

      let result;
      
      if (eventId || initialData) {
        // Update existing event
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: eventData,
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
        // Create new event
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: eventData,
            p_additional_persons: additionalPersons,
            p_user_id: user.id
          });

        if (result.error) throw result.error;

        const newEventId = result.data;
        
        console.log("✅ Event created with ID:", newEventId);
        
        // Upload files for new event
        if (files.length > 0) {
          await uploadFiles(newEventId);
        }

        // Wait a bit for recurring events to be generated
        if (isRecurring && repeatPattern) {
          console.log("⏳ Waiting for recurring instances to be generated...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Send email notification for new event creation
        console.log("🔔 Attempting to send event creation email for internal event");
        if (socialNetworkLink && socialNetworkLink.includes('@')) {
          try {
            const emailResult = await sendEventCreationEmail(
              socialNetworkLink,
              userSurname || title,
              "", // businessName will be resolved from user's business profile
              localDateTimeToISOString(startDate), // Use converted date
              localDateTimeToISOString(endDate), // Use converted date
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
                description: isRecurring ? "Recurring event series created and confirmation email sent!" : "Event created and confirmation email sent!",
              });
            } else {
              console.error("❌ Failed to send event creation email:", emailResult.error);
              toast({
                title: "Event Created",
                description: isRecurring ? "Recurring event series created successfully, but email notification failed to send." : "Event created successfully, but email notification failed to send.",
              });
            }
          } catch (emailError) {
            console.error("❌ Error sending event creation email:", emailError);
            toast({
              title: "Event Created", 
              description: isRecurring ? "Recurring event series created successfully, but email notification failed to send." : "Event created successfully, but email notification failed to send.",
            });
          }
        } else {
          toast({
            title: "Success",
            description: isRecurring ? "Recurring event series created successfully" : "Event created successfully",
          });
        }
        
        onEventCreated?.();
      }

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteThis = async () => {
    if (!eventId && !initialData?.id) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId || initialData?.id);
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      
      onEventDeleted?.();
      setShowDeleteDialog(false);
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

  const handleDeleteSeries = async () => {
    if (!eventId && !initialData?.id) return;
    
    setIsLoading(true);
    
    try {
      const targetEventId = eventId || initialData?.id;
      const parentId = isVirtualEvent && eventId ? getParentEventId(eventId) : targetEventId;
      
      // Use the delete_recurring_series function
      const { error } = await supabase
        .rpc('delete_recurring_series', {
          p_event_id: parentId,
          p_user_id: user?.id,
          p_delete_choice: 'series'
        });
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Event series deleted successfully",
      });
      
      onEventDeleted?.();
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting event series:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event series",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {eventId || initialData ? "Edit Event" : "Create New Event"}
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
              repeatUntil={repeatUntil}
              setRepeatUntil={setRepeatUntil}
              files={files}
              setFiles={setFiles}
              existingFiles={existingFiles}
              setExistingFiles={setExistingFiles}
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
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isLoading}
                  >
                    Delete Event
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
                  {isLoading ? "Saving..." : eventId || initialData ? "Update Event" : "Create Event"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onDeleteThis={handleDeleteThis}
        onDeleteSeries={handleDeleteSeries}
        isRecurringEvent={isRecurringEvent}
      />
    </>
  );
};
