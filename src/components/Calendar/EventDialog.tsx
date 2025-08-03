import { useState, useEffect } from "react";
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEventType | null;
  onSave: (event: Partial<CalendarEventType>) => Promise<void>;
  onDelete: ((id: string, deleteChoice?: "this" | "series") => Promise<void>) | undefined;
  businessId?: string;
  isNewEvent?: boolean;
}

const formatDateTimeLocal = (dateISO: string): string => {
  const date = new Date(dateISO);
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

export const EventDialog = ({ 
  isOpen, 
  onClose, 
  event, 
  onSave, 
  onDelete,
  businessId,
  isNewEvent = false
}: EventDialogProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventName, setEventName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("weekly");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [additionalPersons, setAdditionalPersons] = useState<Array<{
    id: string;
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>>([]);
  const isVirtualEvent = false;

  // Email reminder state - add these states
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState("");

  useEffect(() => {
    if (event && !isNewEvent) {
      console.log("🔄 Loading event data into dialog:", event);
      setTitle(event.title || "");
      setUserSurname(event.user_surname || event.title || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setEventName(event.event_name || "");
      setPaymentStatus(event.payment_status || 'not_paid');
      setPaymentAmount(event.payment_amount?.toString() || "");
      setStartDate(event.start_date ? formatDateTimeLocal(event.start_date) : "");
      setEndDate(event.end_date ? formatDateTimeLocal(event.end_date) : "");
      setIsRecurring(event.is_recurring || false);
      setRepeatPattern(event.repeat_pattern || "weekly");
      setRepeatUntil(event.repeat_until || "");
      
      // Set email reminder data
      setEmailReminderEnabled(event.email_reminder_enabled || false);
      setReminderAt(event.reminder_at || "");
      
      console.log("📧 Email reminder data loaded:", {
        enabled: event.email_reminder_enabled,
        reminderAt: event.reminder_at
      });
    } else if (isNewEvent) {
      // Reset all fields for new events
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setPaymentStatus('not_paid');
      setPaymentAmount("");
      setStartDate("");
      setEndDate("");
      setIsRecurring(false);
      setRepeatPattern("weekly");
      setRepeatUntil("");
      setEmailReminderEnabled(false);
      setReminderAt("");
      setFiles([]);
      setExistingFiles([]);
      setAdditionalPersons([]);
    }
  }, [event, isNewEvent]);

  const handleClose = () => {
    onClose();
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (event?.id && onDelete) {
      try {
        await onDelete(event.id, deleteChoice);
        toast({
          title: t("common.success"),
          description: t("calendar.eventDeleted"),
        });
        onClose();
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: error.message || t("calendar.failedToDeleteEvent"),
        });
      }
    }
  };

  const handleSave = async () => {
    try {
      const eventData: Partial<CalendarEventType> = {
        id: event?.id,
        title: userSurname || title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus as 'not_paid' | 'partly_paid' | 'fully_paid',
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        type: event?.type || 'event',
        is_recurring: isRecurring,
        repeat_pattern: repeatPattern as 'daily' | 'weekly' | 'monthly' | 'yearly',
        repeat_until: repeatUntil,
        // Include email reminder data
        email_reminder_enabled: emailReminderEnabled,
        reminder_at: reminderAt
      };

      console.log("💾 Saving event with reminder data:", {
        emailReminderEnabled,
        reminderAt
      });

      await onSave(eventData);
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNewEvent ? t('calendar.createEvent') : t('calendar.editEvent')}</DialogTitle>
          <DialogDescription>
            {t('calendar.manageEventDetails')}
          </DialogDescription>
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
          additionalPersons={additionalPersons}
          setAdditionalPersons={setAdditionalPersons}
          isVirtualEvent={isVirtualEvent}
          isNewEvent={isNewEvent}
          emailReminderEnabled={emailReminderEnabled}
          setEmailReminderEnabled={setEmailReminderEnabled}
          reminderAt={reminderAt}
          setReminderAt={setReminderAt}
        />
        <DialogFooter>
          {onDelete && event?.id ? (
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDelete("this")}
              >
                {t('calendar.deleteThisEvent')}
              </Button>
              {event?.is_recurring && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete("series")}
                >
                  {t('calendar.deleteAllEvents')}
                </Button>
              )}
            </div>
          ) : null}
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
