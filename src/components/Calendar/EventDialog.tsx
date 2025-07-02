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
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>>([]);

  useEffect(() => {
    if (open) {
      if (initialData || eventId) {
        // Editing existing event
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
          setStartDate(eventData.start_date || "");
          setEndDate(eventData.end_date || "");
          setIsRecurring(eventData.is_recurring || false);
          setRepeatPattern(eventData.repeat_pattern || "");
          setRepeatUntil(eventData.repeat_until || "");
        }
      } else if (selectedDate) {
        // Creating new event
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
      const eventData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
      };

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
              startDate,
              endDate,
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
                description: "Event created and confirmation email sent!",
              });
            } else {
              console.error("❌ Failed to send event creation email:", emailResult.error);
              toast({
                title: "Event Created",
                description: "Event created successfully, but email notification failed to send.",
              });
            }
          } catch (emailError) {
            console.error("❌ Error sending event creation email:", emailError);
            toast({
              title: "Event Created", 
              description: "Event created successfully, but email notification failed to send.",
            });
          }
        } else {
          toast({
            title: "Success",
            description: "Event created successfully",
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

  const handleDelete = async () => {
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

  return (
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
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
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
  );
};
