import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventDialogFields } from "./EventDialogFields";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { isVirtualInstance } from "@/lib/recurringEvents";
import { supabase } from "@/integrations/supabase/client";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";

// Define interface for additional person data
interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEventType | null;
  onSave: (data: Partial<CalendarEventType>) => void;
  onDelete?: (event: CalendarEventType, deleteChoice?: "this" | "series") => void;
  isNewEvent?: boolean;
  selectedDate?: Date;
}

export const EventDialog = ({
  open,
  onClose,
  event,
  onSave,
  onDelete,
  isNewEvent = false,
  selectedDate,
}: EventDialogProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  const isGeorgian = language === 'ka';

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
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  
  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  
  // Email reminder state
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState("");

  // Additional persons state
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);

  // Helper function to convert UTC to local datetime-local format
  const convertUTCToLocal = (utc: string | undefined) => {
    if (!utc) return '';
    const date = new Date(utc);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  // Helper function to convert local datetime-local format to UTC
  const convertLocalToUTC = (local: string) => {
    if (!local) return null;
    return new Date(local).toISOString();
  };

  // Load existing files when event changes
  useEffect(() => {
    const loadExistingFiles = async () => {
      if (event?.id) {
        try {
          const { data, error } = await supabase
            .from('event_files')
            .select('id, filename, file_path, content_type, size')
            .eq('event_id', event.id);

          if (error) {
            console.error('Error loading existing files:', error);
            return;
          }

          setExistingFiles(data || []);
        } catch (error) {
          console.error('Error loading existing files:', error);
        }
      } else {
        setExistingFiles([]);
      }
    };

    loadExistingFiles();
  }, [event?.id]);

  // Initialize form with event data or defaults
  useEffect(() => {
    if (event) {
      // Edit existing event
      setTitle(event.title || "");
      setUserSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setEventName(event.event_name || "");
      setStartDate(convertUTCToLocal(event.start_date));
      setEndDate(convertUTCToLocal(event.end_date));
      setPaymentStatus(event.payment_status || "not_paid");
      setPaymentAmount(event.payment_amount?.toString() || "");
      setIsRecurring(event.is_recurring || false);
      setRepeatPattern(event.repeat_pattern || "");
      setRepeatUntil(event.repeat_until || "");
      // Set email reminder fields
      setEmailReminderEnabled(event.email_reminder_enabled || false);
      setReminderAt(convertUTCToLocal(event.reminder_at));
      setAdditionalPersons([]);
    } else if (isNewEvent && selectedDate) {
      // New event with selected date
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(9, 0, 0, 0);
      const endDateTime = new Date(selectedDate);
      endDateTime.setHours(10, 0, 0, 0);
      
      setStartDate(startDateTime.toISOString().slice(0, 16));
      setEndDate(endDateTime.toISOString().slice(0, 16));
      
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
      setEmailReminderEnabled(false);
      setReminderAt("");
      setAdditionalPersons([]);
      setFiles([]);
      setExistingFiles([]);
    } else {
      // Default state
      const now = new Date();
      now.setHours(9, 0, 0, 0);
      const later = new Date();
      later.setHours(10, 0, 0, 0);
      
      setStartDate(now.toISOString().slice(0, 16));
      setEndDate(later.toISOString().slice(0, 16));
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
      setEmailReminderEnabled(false);
      setReminderAt("");
      setAdditionalPersons([]);
      setFiles([]);
      setExistingFiles([]);
    }
  }, [event, isNewEvent, selectedDate]);

  const handleSave = async () => {
    if (!userSurname.trim()) {
      toast({
        title: t("common.error"),
        description: t("events.fullNameRequired"),
        variant: "destructive",
      });
      return;
    }

    // Validate reminder time if email reminder is enabled
    if (emailReminderEnabled && reminderAt && new Date(reminderAt) >= new Date(startDate)) {
      toast({
        title: t("common.error"),
        description: "Reminder must be set before event start time",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const eventData = {
        title: userSurname,
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
        email_reminder_enabled: emailReminderEnabled,
        reminder_at: emailReminderEnabled && reminderAt ? reminderAt : null,
        language: language || 'en',
      };

      console.log("Saving event with reminder data:", {
        email_reminder_enabled: eventData.email_reminder_enabled,
        reminder_at: eventData.reminder_at
      });
      
      await onSave(eventData);
      
      // Upload files if any
      if (files.length > 0 && event?.id) {
        // Handle file uploads here if needed
      }
      
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!event || !onDelete) return;
    
    if (event.is_recurring && !isVirtualInstance(event)) {
      setShowRecurringDeleteDialog(true);
    } else {
      onDelete(event);
      onClose();
    }
  };

  const handleRecurringDelete = (deleteChoice: "this" | "series") => {
    if (!event || !onDelete) return;
    
    onDelete(event, deleteChoice);
    setShowRecurringDeleteDialog(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
              {isGeorgian ? (
                <GeorgianAuthText>
                  {isNewEvent ? "ღონისძიების დამატება" : "ღონისძიების რედაქტირება"}
                </GeorgianAuthText>
              ) : (
                <LanguageText>
                  {isNewEvent ? t("events.addEvent") : t("events.editEvent")}
                </LanguageText>
              )}
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
            eventId={event?.id}
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

          <div className="flex justify-between gap-4 pt-4 border-t">
            {!isNewEvent && event && onDelete && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className={cn(isGeorgian ? "font-georgian" : "")}
              >
                {isGeorgian ? (
                  <GeorgianAuthText>წაშლა</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("common.delete")}</LanguageText>
                )}
              </Button>
            )}
            
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className={cn(isGeorgian ? "font-georgian" : "")}
              >
                {isGeorgian ? (
                  <GeorgianAuthText>გაუქმება</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("common.cancel")}</LanguageText>
                )}
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={loading}
                className={cn(isGeorgian ? "font-georgian" : "")}
              >
                {isGeorgian ? (
                  <GeorgianAuthText>შენახვა</GeorgianAuthText>
                ) : (
                  <LanguageText>{loading ? t("common.saving") : t("common.save")}</LanguageText>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={showRecurringDeleteDialog}
        onClose={() => setShowRecurringDeleteDialog(false)}
        onConfirm={handleRecurringDelete}
      />
    </>
  );
};
