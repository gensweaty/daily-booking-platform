
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CalendarEventType, PersonData } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { isVirtualInstance } from "@/lib/recurringEvents";

export interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  initialData?: CalendarEventType;
  onSave: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onEventCreated?: () => Promise<void>;
  onEventUpdated?: () => Promise<void>;
  onEventDeleted?: () => Promise<void>;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  initialData,
  onSave,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
}: EventDialogProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [loading, setLoading] = useState(false);

  // Basic form fields
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

  // File handling
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);

  // Recurring event fields
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");

  // Additional persons
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);

  // Email reminder fields
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState("");

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Utility functions for datetime conversion
  const convertUTCToLocal = (utcDateTime: string) => {
    if (!utcDateTime) return '';
    const date = new Date(utcDateTime);
    // Convert to local datetime-local format
    const localDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return localDateTime.toISOString().slice(0, 16);
  };

  const convertLocalToUTC = (localDateTime: string) => {
    if (!localDateTime) return null;
    const localDate = new Date(localDateTime);
    return localDate.toISOString();
  };

  // Initialize form with existing data or defaults
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || initialData.user_surname || "");
      setUserSurname(initialData.user_surname || initialData.title || "");
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setEventNotes(initialData.event_notes || "");
      setEventName(initialData.event_name || "");
      setStartDate(convertUTCToLocal(initialData.start_date));
      setEndDate(convertUTCToLocal(initialData.end_date));
      setPaymentStatus(initialData.payment_status || "not_paid");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setIsRecurring(initialData.is_recurring || false);
      setRepeatPattern(initialData.repeat_pattern || "");
      setRepeatUntil(initialData.repeat_until || "");
      
      // Initialize email reminder fields
      setEmailReminderEnabled(!!initialData.email_reminder_enabled);
      setReminderAt(initialData.reminder_at ? convertUTCToLocal(initialData.reminder_at) : '');
      
      // Initialize additional persons
      setAdditionalPersons(initialData.additional_persons || []);

      // Load existing files if eventId exists
      if (initialData.id) {
        loadExistingFiles(initialData.id);
      }
    } else if (selectedDate) {
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(12, 0, 0, 0);
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(13, 0, 0, 0);

      setStartDate(convertUTCToLocal(startDateTime.toISOString()));
      setEndDate(convertUTCToLocal(endDateTime.toISOString()));
      
      // Reset email reminder fields for new events
      setEmailReminderEnabled(false);
      setReminderAt('');
      
      // Reset all other fields
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setIsRecurring(false);
      setRepeatPattern("");
      setRepeatUntil("");
      setAdditionalPersons([]);
      setFiles([]);
      setExistingFiles([]);
    }
  }, [initialData, selectedDate]);

  // Load existing files function
  const loadExistingFiles = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_files')
        .select('id, filename, file_path, content_type, size')
        .eq('event_id', eventId);

      if (error) {
        console.error('Error loading files:', error);
        return;
      }

      setExistingFiles(data || []);
    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  };

  // Handle form submission
  const handleSave = async () => {
    if (!userSurname.trim()) {
      toast({
        title: "Error",
        description: t("events.fullNameRequired"),
        variant: "destructive",
      });
      return;
    }

    // Validate email reminder
    if (emailReminderEnabled && reminderAt) {
      const reminderDate = new Date(reminderAt);
      const eventStart = new Date(startDate);
      if (reminderDate >= eventStart) {
        toast({
          title: "Error",
          description: "Reminder must be before event start time",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const eventData: Partial<CalendarEventType> = {
        title: userSurname,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: convertLocalToUTC(startDate),
        end_date: convertLocalToUTC(endDate),
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        is_recurring: isRecurring,
        repeat_pattern: repeatPattern || undefined,
        repeat_until: repeatUntil || undefined,
        additional_persons: additionalPersons,
        email_reminder_enabled: emailReminderEnabled,
        reminder_at: emailReminderEnabled ? convertLocalToUTC(reminderAt) : null,
      };

      if (initialData?.id) {
        eventData.id = initialData.id;
      }

      console.log('Saving event with reminder data:', {
        email_reminder_enabled: emailReminderEnabled,
        reminder_at: eventData.reminder_at
      });

      await onSave(eventData);
      
      // Handle file uploads if any
      if (files.length > 0) {
        // File upload logic would go here
        console.log('Files to upload:', files);
      }

      onOpenChange(false);
      
      if (initialData) {
        await onEventUpdated?.();
      } else {
        await onEventCreated?.();
      }
      
      toast({
        title: "Success",
        description: initialData ? t("events.eventUpdated") : t("events.eventCreated"),
      });
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (!initialData?.id) return;
    
    try {
      setLoading(true);
      await onEventDeleted?.();
      setShowDeleteDialog(false);
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isNewEvent = !initialData;
  const isBookingRequest = initialData?.type === 'booking_request';
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
              {isGeorgian ? (
                <GeorgianAuthText>
                  {initialData ? "მოვლენის რედაქტირება" : "ახალი მოვლენა"}
                </GeorgianAuthText>
              ) : (
                <LanguageText>
                  {initialData ? t("events.editEvent") : t("events.newEvent")}
                </LanguageText>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
              isBookingRequest={isBookingRequest}
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              repeatPattern={repeatPattern}
              setRepeatPattern={setRepeatPattern}
              repeatUntil={repeatUntil}
              setRepeatUntil={setRepeatUntil}
              isNewEvent={isNewEvent}
              additionalPersons={additionalPersons}
              setAdditionalPersons={setAdditionalPersons}
              emailReminderEnabled={emailReminderEnabled}
              setEmailReminderEnabled={setEmailReminderEnabled}
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSave} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Saving..." : (initialData ? t("common.update") : t("common.create"))}
            </Button>
            
            {initialData && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (initialData.is_recurring || initialData.parent_event_id) {
                    setShowDeleteDialog(true);
                  } else {
                    handleDelete();
                  }
                }}
                disabled={loading}
              >
                {t("common.delete")}
              </Button>
            )}
            
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onDelete={handleDelete}
        isVirtualInstance={isVirtualInstance(initialData?.id || '')}
      />
    </>
  );
};
