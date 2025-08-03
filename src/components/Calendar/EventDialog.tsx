
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { EventDialogFields } from "./EventDialogFields";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";

// Helper function to convert UTC to local datetime-local format
const utcToLocal = (utcString: string | null): string => {
  if (!utcString) return '';
  
  const date = new Date(utcString);
  // Get timezone offset in minutes and convert to milliseconds
  const offset = date.getTimezoneOffset() * 60000;
  // Subtract offset to get local time
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

// Helper function to convert local datetime-local to UTC ISO string
const localToUtc = (localString: string): string => {
  if (!localString) return '';
  
  const date = new Date(localString);
  return date.toISOString();
};

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData?: CalendarEventType | null;
}

export const EventDialog = ({ isOpen, onClose, onSave, initialData }: EventDialogProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  // Form state
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
  
  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("weekly");
  const [repeatUntil, setRepeatUntil] = useState("");
  
  // Reminder state - using emailReminderEnabled to match interface
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState("");
  
  // Additional persons
  const [additionalPersons, setAdditionalPersons] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form when dialog opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Editing existing event - convert UTC times to local
        setTitle(initialData.title || "");
        setUserSurname(initialData.user_surname || "");
        setUserNumber(initialData.user_number || "");
        setSocialNetworkLink(initialData.social_network_link || "");
        setEventNotes(initialData.event_notes || "");
        setEventName(initialData.event_name || "");
        setStartDate(utcToLocal(initialData.start_date));
        setEndDate(utcToLocal(initialData.end_date));
        setPaymentStatus(initialData.payment_status || "not_paid");
        setPaymentAmount(initialData.payment_amount?.toString() || "");
        
        // Recurring fields
        setIsRecurring(initialData.is_recurring || false);
        setRepeatPattern(initialData.repeat_pattern || "weekly");
        setRepeatUntil(initialData.repeat_until || "");
        
        // Reminder fields - convert UTC to local and use emailReminderEnabled
        setEmailReminderEnabled(initialData.reminder_enabled || initialData.email_reminder_enabled || false);
        setReminderAt(utcToLocal(initialData.reminder_at));
        
        // Load existing files
        setExistingFiles(initialData.files || []);
        setFiles([]);
        setAdditionalPersons(initialData.additional_persons || []);
      } else {
        // Creating new event - use current time in local format
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        
        setTitle("");
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setEventName("");
        setStartDate(utcToLocal(now.toISOString()));
        setEndDate(utcToLocal(oneHourLater.toISOString()));
        setPaymentStatus("not_paid");
        setPaymentAmount("");
        
        setIsRecurring(false);
        setRepeatPattern("weekly");
        setRepeatUntil("");
        
        setEmailReminderEnabled(false);
        setReminderAt("");
        
        setFiles([]);
        setExistingFiles([]);
        setAdditionalPersons([]);
      }
    }
  }, [isOpen, initialData]);

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (!title.trim() && !userSurname.trim()) {
      toast({
        title: t("common.error"),
        description: "Please enter a title or name",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: "Please enter start and end dates",
        variant: "destructive",
      });
      return;
    }

    // Reminder validation
    if (emailReminderEnabled && reminderAt) {
      const reminderTime = new Date(reminderAt);
      const eventStartTime = new Date(startDate);
      
      if (reminderTime >= eventStartTime) {
        toast({
          title: t("common.error"),
          description: "Reminder must be before event start",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      // Convert local times to UTC for database
      const eventData = {
        title: title.trim() || userSurname.trim(),
        user_surname: userSurname.trim() || title.trim(),
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: localToUtc(startDate),
        end_date: localToUtc(endDate),
        payment_status: paymentStatus,
        payment_amount: paymentAmount || null,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
        reminder_enabled: emailReminderEnabled,
        email_reminder_enabled: emailReminderEnabled, // For backward compatibility
        reminder_at: emailReminderEnabled && reminderAt ? localToUtc(reminderAt) : null,
      };

      console.log("🔍 Saving event data:", {
        ...eventData,
        startDateLocal: startDate,
        endDateLocal: endDate,
        reminderAtLocal: reminderAt,
      });

      const { data, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: eventData,
        p_additional_persons: additionalPersons,
        p_user_id: user.id,
        p_event_id: initialData?.id || null,
      });

      if (error) {
        console.error("Error saving event:", error);
        throw error;
      }

      console.log("✅ Event saved successfully:", data);

      toast({
        title: t("common.success"),
        description: initialData ? t("common.updated") : t("common.created"),
      });

      onSave();
      onClose();
    } catch (error) {
      console.error("Error in handleSave:", error);
      toast({
        title: t("common.error"),
        description: "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? t("calendar.editEvent") : t("calendar.newEvent")}
          </DialogTitle>
        </DialogHeader>

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
          reminderAt={reminderAt}
          setReminderAt={setReminderAt}
          emailReminderEnabled={emailReminderEnabled}
          setEmailReminderEnabled={setEmailReminderEnabled}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
