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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { EventDialogFields } from "./EventDialogFields";
import { useQueryClient } from "@tanstack/react-query";

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: CalendarEventType | null;
  onCreate: (data: Partial<CalendarEventType>) => Promise<void>;
  onUpdate: (data: Partial<CalendarEventType>) => Promise<void>;
  onDelete: () => Promise<void>;
  isBookingRequest?: boolean;
}

export const EventDialog = ({
  isOpen,
  onClose,
  selectedEvent,
  onCreate,
  onUpdate,
  onDelete,
  isBookingRequest = false,
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
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
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [additionalPersons, setAdditionalPersons] = useState([]);
  
  // Add reminder state
  const [reminderAt, setReminderAt] = useState<string | undefined>(undefined);
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);

  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title || "");
      setUserSurname(selectedEvent.user_surname || "");
      setUserNumber(selectedEvent.user_number || "");
      setSocialNetworkLink(selectedEvent.social_network_link || "");
      setEventNotes(selectedEvent.event_notes || "");
      setEventName(selectedEvent.event_name || "");
      setStartDate(selectedEvent.start_date || "");
      setEndDate(selectedEvent.end_date || "");
      setPaymentStatus(selectedEvent.payment_status || "not_paid");
      setPaymentAmount(selectedEvent.payment_amount?.toString() || "");
      setIsRecurring(selectedEvent.is_recurring || false);
      setRepeatPattern(selectedEvent.repeat_pattern || "");
      setRepeatUntil(selectedEvent.repeat_until || "");
      setAdditionalPersons(selectedEvent.additionalPersons || []);
      
      // Set reminder data
      setReminderAt(selectedEvent.reminder_at);
      setEmailReminderEnabled(selectedEvent.email_reminder_enabled || false);
    } else {
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
      setIsRecurring(false);
      setRepeatPattern("");
      setRepeatUntil("");
      setAdditionalPersons([]);
      
      // Reset reminder data
      setReminderAt(undefined);
      setEmailReminderEnabled(false);
    }
  }, [selectedEvent]);

  // Function to handle file uploads
  const uploadFiles = async (eventId: string) => {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/api/upload-event-files?eventId=${eventId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error('File upload failed:', response.statusText);
        return;
      }

      // Refresh event files after upload
      const uploadedFiles = await response.json();
      setExistingFiles([...existingFiles, ...uploadedFiles]);
      setFiles([]); // Clear the selected files after successful upload
      queryClient.invalidateQueries(['eventFiles', eventId]);
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: t("events.titleRequired"),
        variant: "destructive",
      });
      return;
    }

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
        payment_amount: parseFloat(paymentAmount),
        is_recurring: isRecurring,
        repeat_pattern: repeatPattern,
        repeat_until: repeatUntil,
        additionalPersons: additionalPersons,
        reminder_at: reminderAt,
        email_reminder_enabled: emailReminderEnabled,
      };

      if (selectedEvent) {
        await onUpdate(eventData);
        if (selectedEvent.id) {
          await uploadFiles(selectedEvent.id);
        }
      } else {
        await onCreate(eventData);
        // Fetch the events again to update the calendar
        queryClient.invalidateQueries({ queryKey: ['events'] });
        // Optionally, show a success message
        toast({
          title: "Success",
          description: t("events.eventCreated"),
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedEvent ? t("events.editEvent") : t("events.addEvent")}
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
            eventId={selectedEvent?.id}
            isBookingRequest={isBookingRequest}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={repeatUntil}
            setRepeatUntil={setRepeatUntil}
            isNewEvent={!selectedEvent}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            
            // Add reminder props - but don't expose them in EventDialogFields yet
            // The reminder functionality is handled internally in EventDialogFields
          />
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">
              {selectedEvent ? t("common.save") : t("events.addEvent")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
