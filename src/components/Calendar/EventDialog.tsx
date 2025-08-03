import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { useEventDialog } from "./hooks/useEventDialog";
import { EventDialogFields } from "./EventDialogFields";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import { format } from "date-fns";
import { isVirtualInstance } from "@/lib/recurringEvents";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  initialData?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted
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
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  const [additionalPersons, setAdditionalPersons] = useState<any[]>([]);
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState("");

  const { toast } = useToast();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  // Create the event dialog hook with proper functions that maintain existing email flow
  const {
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent: async (eventData) => {
      // This will maintain the existing email notification flow
      return eventData as CalendarEventType;
    },
    updateEvent: async (eventData) => {
      // This will maintain the existing email notification flow  
      return eventData as CalendarEventType;
    },
    deleteEvent: async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
      try {
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;

        return { success: true };
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    }
  });

  const loadExistingFiles = async (eventId: string) => {
    try {
      const { data: files, error } = await supabase
        .from('event_files')
        .select('id, filename, file_path, content_type, size')
        .eq('event_id', eventId);

      if (error) {
        console.error('Error loading existing files:', error);
        return;
      }

      setExistingFiles(files || []);
    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  };

  useEffect(() => {
    if (initialData) {
      // Editing existing event
      setTitle(initialData.title || "");
      setUserSurname(initialData.user_surname || "");
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setEventNotes(initialData.event_notes || "");
      setEventName(initialData.event_name || "");
      setPaymentStatus(initialData.payment_status || "not_paid");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setIsRecurring(initialData.is_recurring || false);
      setRepeatPattern(initialData.repeat_pattern || "");
      setRepeatUntil(initialData.repeat_until || "");
      
      // Set email reminder data
      setEmailReminderEnabled(initialData.email_reminder_enabled || false);
      setReminderAt(initialData.reminder_at ? format(new Date(initialData.reminder_at), "yyyy-MM-dd'T'HH:mm") : "");

      // Format dates for datetime-local input
      const startDateTime = new Date(initialData.start_date);
      const endDateTime = new Date(initialData.end_date);
      
      setStartDate(format(startDateTime, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(endDateTime, "yyyy-MM-dd'T'HH:mm"));

      // Load existing files - FIXED: pass the string ID, not the entire object
      if (initialData.id) {
        loadExistingFiles(initialData.id);
      }
    } else if (selectedDate) {
      // Creating new event with selected date
      const defaultStart = new Date(selectedDate);
      const defaultEnd = new Date(selectedDate);
      defaultEnd.setHours(defaultStart.getHours() + 1);

      setStartDate(format(defaultStart, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(defaultEnd, "yyyy-MM-dd'T'HH:mm"));
      
      // Reset form for new event
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setFiles([]);
      setExistingFiles([]);
      setIsRecurring(false);
      setRepeatPattern("");
      setRepeatUntil("");
      setAdditionalPersons([]);
      
      // Reset email reminder
      setEmailReminderEnabled(false);
      setReminderAt("");
    }
  }, [initialData, selectedDate]);

  const uploadFiles = async (eventId: string) => {
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const fileName = `${eventId}/${Date.now()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('event_files')
          .insert({
            event_id: eventId,
            filename: file.name,
            file_path: uploadData.path,
            content_type: file.type,
            size: file.size,
            user_id: user?.id
          });

        if (dbError) throw dbError;
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: "Warning",
          description: `Failed to upload file: ${file.name}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);
    
    try {
      const eventData = {
        title: userSurname || title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        type: initialData?.type || 'event',
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: (isRecurring && repeatUntil) ? repeatUntil : null,
        language: language,
        // Add email reminder data to the event payload
        email_reminder_enabled: emailReminderEnabled,
        reminder_at: reminderAt || null
      };

      let result;
      if (initialData?.id) {
        // For updates, we need to update the database directly to include email reminder fields
        console.log("Updating event with email reminder data:", { 
          emailReminderEnabled, 
          reminderAt,
          ...eventData 
        });
        
        const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
          p_event_data: eventData as any,
          p_additional_persons: [],
          p_user_id: user.id,
          p_event_id: initialData.id
        });

        if (error) throw error;
        
        result = {
          id: savedEventId,
          title: eventData.user_surname || eventData.title || 'Untitled Event',
          start_date: eventData.start_date || new Date().toISOString(),
          end_date: eventData.end_date || new Date().toISOString(),
          user_id: user.id,
          type: eventData.type || 'event',
          created_at: initialData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_reminder_enabled: emailReminderEnabled,
          reminder_at: reminderAt || undefined,
          ...eventData
        } as CalendarEventType;
        
        if (files.length > 0) {
          await uploadFiles(initialData.id);
        }
        onEventUpdated?.();
      } else {
        // For creation, we need to create the event directly to include email reminder fields
        console.log("Creating event with email reminder data:", { 
          emailReminderEnabled, 
          reminderAt,
          ...eventData 
        });
        
        const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
          p_event_data: eventData as any,
          p_additional_persons: [],
          p_user_id: user.id,
          p_event_id: null
        });

        if (error) throw error;
        
        result = {
          id: savedEventId,
          title: eventData.user_surname || eventData.title || 'Untitled Event',
          start_date: eventData.start_date || new Date().toISOString(),
          end_date: eventData.end_date || new Date().toISOString(),
          user_id: user.id,
          type: eventData.type || 'event',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_reminder_enabled: emailReminderEnabled,
          reminder_at: reminderAt || undefined,
          ...eventData
        } as CalendarEventType;
        
        if (files.length > 0) {
          await uploadFiles(result.id);
        }
        onEventCreated?.();
      }

      onOpenChange(false);
      
      // Reset form
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setFiles([]);
      setExistingFiles([]);
      setIsRecurring(false);
      setRepeatPattern("");
      setRepeatUntil("");
      setAdditionalPersons([]);
      setEmailReminderEnabled(false);
      setReminderAt("");
      
    } catch (error) {
      console.error('Failed to save event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    
    const isRecurringEvent = initialData.is_recurring || initialData.parent_event_id;
    const isVirtualEvent = isVirtualInstance(initialData);
    
    if (isRecurringEvent && !isVirtualEvent) {
      setShowRecurringDeleteDialog(true);
      return;
    }
    
    try {
      await handleDeleteEvent({ id: initialData.id });
      onEventDeleted?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handleRecurringDelete = async (deleteChoice: "this" | "series") => {
    if (!initialData) return;
    
    try {
      await handleDeleteEvent({ id: initialData.id, deleteChoice });
      onEventDeleted?.();
      onOpenChange(false);
      setShowRecurringDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete recurring event:', error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {initialData ? 
                (isGeorgian ? <GeorgianAuthText>მოვლენის რედაქტირება</GeorgianAuthText> : <LanguageText>Edit Event</LanguageText>) : 
                (isGeorgian ? <GeorgianAuthText>ახალი მოვლენა</GeorgianAuthText> : <LanguageText>Add Event</LanguageText>)
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
              files={files}
              setFiles={setFiles}
              existingFiles={existingFiles}
              setExistingFiles={setExistingFiles}
              eventId={initialData?.id}
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              repeatPattern={repeatPattern}
              setRepeatPattern={setRepeatPattern}
              repeatUntil={repeatUntil}
              setRepeatUntil={setRepeatUntil}
              isNewEvent={!initialData}
              additionalPersons={additionalPersons}
              setAdditionalPersons={setAdditionalPersons}
              emailReminderEnabled={emailReminderEnabled}
              setEmailReminderEnabled={setEmailReminderEnabled}
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
            />

            <div className="flex justify-between pt-4">
              {initialData && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>Delete</LanguageText>}
                </Button>
              )}
              
              <div className="flex gap-2 ml-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  {isGeorgian ? <GeorgianAuthText>გაუქმება</GeorgianAuthText> : <LanguageText>Cancel</LanguageText>}
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  {loading ? 
                    (isGeorgian ? <GeorgianAuthText>შენახვა...</GeorgianAuthText> : <LanguageText>Saving...</LanguageText>) : 
                    (isGeorgian ? <GeorgianAuthText>შენახვა</GeorgianAuthText> : <LanguageText>Save</LanguageText>)
                  }
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={showRecurringDeleteDialog}
        onOpenChange={setShowRecurringDeleteDialog}
        onDeleteThis={() => handleRecurringDelete("this")}
        onDeleteSeries={() => handleRecurringDelete("series")}
        isRecurringEvent={true}
        isLoading={loading}
      />
    </>
  );
};
