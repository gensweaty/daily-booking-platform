
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EventDialogFields } from "./EventDialogFields";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isVirtualInstance } from "@/lib/recurringEvents";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: CalendarEventType | null;
  onCreate?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onUpdate?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onDelete?: ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => Promise<{ success: boolean; }>;
  isNewEvent?: boolean;
  selectedDate?: Date;
  onEventCreated?: () => Promise<void>;
  onEventUpdated?: () => Promise<void>;
  onEventDeleted?: () => Promise<void>;
}

export const EventDialog = ({
  open,
  onOpenChange,
  initialData,
  onCreate,
  onUpdate,
  onDelete,
  isNewEvent = false,
  selectedDate,
  onEventCreated,
  onEventUpdated,
  onEventDeleted
}) => {
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
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [additionalPersons, setAdditionalPersons] = useState<any[]>([]);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const resetForm = () => {
    setTitle("");
    setUserSurname("");
    setUserNumber("");
    setSocialNetworkLink("");
    setEventNotes("");
    setEventName("");
    setStartDate("");
    setEndDate("");
    setPaymentStatus("not_paid");
    setPaymentAmount("");
    setFiles([]);
    setExistingFiles([]);
    setIsRecurring(false);
    setRepeatPattern("");
    setRepeatUntil("");
    setAdditionalPersons([]);
  };

  // Load existing data when editing
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setUserSurname(initialData.user_surname || "");
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setEventNotes(initialData.event_notes || "");
      setEventName(initialData.event_name || "");
      setStartDate(initialData.start_date || "");
      setEndDate(initialData.end_date || "");
      setPaymentStatus(initialData.payment_status || "not_paid");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setIsRecurring(initialData.is_recurring || false);
      setRepeatPattern(initialData.repeat_pattern || "");
      setRepeatUntil(initialData.repeat_until || "");
      setExistingFiles(initialData.files || []);
      setAdditionalPersons([]);
      setReminderTime(initialData.reminder_time ? new Date(initialData.reminder_time) : null);
      setReminderEnabled(!!initialData.reminder_time);
    } else {
      resetForm();
      setReminderTime(null);
      setReminderEnabled(false);
    }
  }, [initialData]);

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    if (onCreate) {
      try {
        await onCreate(data);
        toast({
          title: "Success",
          description: "Event created successfully",
        });
        onOpenChange(false);
        if (onEventCreated) {
          await onEventCreated();
        }
      } catch (error: any) {
        console.error("Error creating event:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to create event",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpdateEvent = async (data: Partial<CalendarEventType>) => {
    if (onUpdate) {
      try {
        await onUpdate(data);
        toast({
          title: "Success",
          description: "Event updated successfully",
        });
        onOpenChange(false);
        if (onEventUpdated) {
          await onEventUpdated();
        }
      } catch (error: any) {
        console.error("Error updating event:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to update event",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteEvent = async (deleteChoice?: "this" | "series") => {
    if (onDelete && initialData) {
      try {
        await onDelete({ id: initialData.id, deleteChoice });
        toast({
          title: "Success",
          description: "Event deleted successfully",
        });
        onOpenChange(false);
        if (onEventDeleted) {
          await onEventDeleted();
        }
      } catch (error: any) {
        console.error("Error deleting event:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete event",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const eventData: Partial<CalendarEventType> = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: parseFloat(paymentAmount) || 0,
        is_recurring: isRecurring,
        repeat_pattern: repeatPattern,
        repeat_until: repeatUntil,
        files: files as any, // Type assertion to handle the File[] vs expected type mismatch
        additionalPersons,
        reminder_time: reminderEnabled && reminderTime ? reminderTime.toISOString() : null,
      };

      if (initialData) {
        await handleUpdateEvent(eventData);
      } else {
        await handleCreateEvent(eventData);
      }
    } catch (error) {
      console.error('Error submitting event:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? t("events.editEvent") : t("events.newEvent")}</DialogTitle>
          <DialogDescription>
            {initialData ? t("events.editEventDetails") : t("events.createEventDetails")}
          </DialogDescription>
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
            isBookingRequest={initialData?.type === 'booking_request'}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={repeatUntil}
            setRepeatUntil={setRepeatUntil}
            isNewEvent={isNewEvent}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            reminderTime={reminderTime}
            setReminderTime={setReminderTime}
            reminderEnabled={reminderEnabled}
            setReminderEnabled={setReminderEnabled}
          />

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.submitting") : t("common.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
