import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { isVirtualInstance } from "@/lib/recurringEvents";

// Define interface for person data
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
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: CalendarEventType | null;
  onCreateEvent: (data: Partial<CalendarEventType>) => Promise<void>;
  onUpdateEvent: (data: Partial<CalendarEventType> & { id: string }) => Promise<void>;
  onDeleteEvent: (id: string, deleteChoice?: "this" | "series") => Promise<void>;
  selectedDate?: Date;
  isLoading?: boolean;
}

export const EventDialog = ({
  isOpen,
  onClose,
  selectedEvent,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  selectedDate,
  isLoading
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

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  
  // Additional persons state
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  
  // Delete confirmation state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
  // Add reminder state variables - NEW
  const [reminderAt, setReminderAt] = useState("");
  const [emailReminder, setEmailReminder] = useState(false);

  const { toast } = useToast();
  const { t, language } = useLanguage();
  const formRef = useRef<HTMLFormElement>(null);

  const isGeorgian = language === 'ka';
  const isNewEvent = !selectedEvent;
  const isBookingRequest = selectedEvent?.type === 'booking_request';

  // Check if this is a virtual recurring instance
  const isVirtual = selectedEvent ? isVirtualInstance(selectedEvent) : false;

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  // Initialize form with existing event data
  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title || "");
      setUserSurname(selectedEvent.user_surname || selectedEvent.title || "");
      setUserNumber(selectedEvent.user_number || "");
      setSocialNetworkLink(selectedEvent.social_network_link || "");
      setEventNotes(selectedEvent.event_notes || "");
      setEventName(selectedEvent.event_name || "");
      setStartDate(selectedEvent.start_date || "");
      setEndDate(selectedEvent.end_date || "");
      setPaymentStatus(selectedEvent.payment_status || "not_paid");
      setPaymentAmount(selectedEvent.payment_amount?.toString() || "");
      setFiles([]);
      
      // Initialize recurring fields
      setIsRecurring(selectedEvent.is_recurring || false);
      setRepeatPattern(selectedEvent.repeat_pattern || "");
      setRepeatUntil(selectedEvent.repeat_until || "");
      
      // Initialize reminder fields - NEW
      setReminderAt(selectedEvent.reminder_at || "");
      setEmailReminder(selectedEvent.email_reminder_enabled || false);

      // Load existing files if any
      if (selectedEvent.files && selectedEvent.files.length > 0) {
        setExistingFiles(selectedEvent.files);
      } else {
        setExistingFiles([]);
      }
    } else if (selectedDate) {
      // Default values for new event
      const defaultStart = new Date(selectedDate);
      const defaultEnd = new Date(selectedDate);
      defaultEnd.setHours(defaultStart.getHours() + 1);

      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setStartDate(formatDateTimeLocal(defaultStart));
      setEndDate(formatDateTimeLocal(defaultEnd));
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setFiles([]);
      setExistingFiles([]);
      
      // Reset recurring fields
      setIsRecurring(false);
      setRepeatPattern("");
      setRepeatUntil("");
      
      // Reset reminder fields - NEW
      setReminderAt("");
      setEmailReminder(false);
    }

    // Reset additional persons
    setAdditionalPersons([]);
  }, [selectedEvent, selectedDate]);

  // Handle form reset
  const handleReset = () => {
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
    setAdditionalPersons([]);
    
    // Reset recurring fields
    setIsRecurring(false);
    setRepeatPattern("");
    setRepeatUntil("");
    
    // Reset reminder fields - NEW
    setReminderAt("");
    setEmailReminder(false);
  };

  const formatDateTimeLocal = (date: Date): string => {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().slice(0, 16);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userSurname.trim()) {
      toast({
        title: "Error",
        description: t("events.nameRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Error", 
        description: t("events.dateRequired"),
        variant: "destructive",
      });
      return;
    }

    const eventData: Partial<CalendarEventType> = {
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
      language: language,
      // Include recurring fields
      is_recurring: isNewEvent ? isRecurring : undefined,
      repeat_pattern: isNewEvent && isRecurring ? repeatPattern : undefined,
      repeat_until: isNewEvent && isRecurring ? repeatUntil : undefined,
      // Include reminder fields - NEW
      reminder_at: reminderAt && reminderAt.trim() !== '' ? reminderAt : undefined,
      email_reminder_enabled: emailReminder && reminderAt ? emailReminder : false
    };

    try {
      if (selectedEvent) {
        await onUpdateEvent({ ...eventData, id: selectedEvent.id });
      } else {
        await onCreateEvent(eventData);
      }
      handleReset();
      onClose();
    } catch (error: any) {
      console.error("Error saving event:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    
    if (selectedEvent.is_recurring || selectedEvent.parent_event_id) {
      setShowDeleteConfirmation(true);
    } else {
      try {
        await onDeleteEvent(selectedEvent.id);
        onClose();
      } catch (error) {
        console.error("Error deleting event:", error);
      }
    }
  };

  const handleDeleteConfirm = async (deleteChoice: "this" | "series") => {
    if (!selectedEvent) return;
    
    try {
      await onDeleteEvent(selectedEvent.id, deleteChoice);
      setShowDeleteConfirmation(false);
      onClose();
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle 
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              {isNewEvent ? (
                isGeorgian ? <GeorgianAuthText>ახალი ღონისძიება</GeorgianAuthText> : <LanguageText>{t("events.newEvent")}</LanguageText>
              ) : (
                isGeorgian ? <GeorgianAuthText>ღონისძიების რედაქტირება</GeorgianAuthText> : <LanguageText>{t("events.editEvent")}</LanguageText>
              )}
            </DialogTitle>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
              isNewEvent={isNewEvent}
              additionalPersons={additionalPersons}
              setAdditionalPersons={setAdditionalPersons}
              // Pass reminder props - NEW
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
              emailReminder={emailReminder}
              setEmailReminder={setEmailReminder}
            />

            <div className="flex justify-end space-x-2 pt-4">
              {selectedEvent && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className={cn(isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              >
                {isGeorgian ? <GeorgianAuthText>გაუქმება</GeorgianAuthText> : <LanguageText>{t("common.cancel")}</LanguageText>}
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className={cn(isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              >
                {isLoading ? (
                  isGeorgian ? <GeorgianAuthText>შენახვა...</GeorgianAuthText> : <LanguageText>{t("common.saving")}...</LanguageText>
                ) : selectedEvent ? (
                  isGeorgian ? <GeorgianAuthText>განახლება</GeorgianAuthText> : <LanguageText>{t("common.update")}</LanguageText>
                ) : (
                  isGeorgian ? <GeorgianAuthText>შექმნა</GeorgianAuthText> : <LanguageText>{t("common.create")}</LanguageText>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleDeleteConfirm}
        eventTitle={selectedEvent?.title || ""}
        isRecurring={selectedEvent?.is_recurring || false}
        isVirtualInstance={isVirtual}
      />
    </>
  );
};
