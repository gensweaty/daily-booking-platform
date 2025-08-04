import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventDialogFields } from "./EventDialogFields";
import { useState, useEffect } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useEventDialog } from "./hooks/useEventDialog";
import { LanguageText } from "@/components/shared/LanguageText";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";
import { Trash2, X } from "lucide-react";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { isVirtualInstance } from "@/lib/recurringEvents";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useTimezoneValidation } from "@/hooks/useTimezoneValidation";
import { useToast } from "@/components/ui/use-toast";

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: CalendarEventType | null;
  selectedDate: Date | undefined;
  createEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent?: ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => Promise<{ success: boolean; }>;
}

interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

export const EventDialog = ({
  isOpen,
  onClose,
  selectedEvent,
  selectedDate,
  createEvent,
  updateEvent,
  deleteEvent,
}: EventDialogProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { validateDateTime } = useTimezoneValidation();
  const isGeorgian = language === 'ka';
  
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
  const [repeatPattern, setRepeatPattern] = useState('');
  const [repeatUntil, setRepeatUntil] = useState('');
  
  // Email reminder state - NEW
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState<string | undefined>(undefined);
  
  // Additional persons state
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  
  // Dialog state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurringDeleteOpen, setIsRecurringDeleteOpen] = useState(false);

  const isBookingRequest = selectedEvent?.type === 'booking_request';
  const isVirtualEvent = selectedEvent && isVirtualInstance(selectedEvent);
  const isNewEvent = !selectedEvent;

  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title || "");
      setUserSurname(selectedEvent.user_surname || "");
      setUserNumber(selectedEvent.user_number || "");
      setSocialNetworkLink(selectedEvent.social_network_link || "");
      setEventNotes(selectedEvent.event_notes || "");
      setEventName(selectedEvent.event_name || "");
      setStartDate(selectedEvent.start_date ? new Date(selectedEvent.start_date).toISOString().slice(0, 16) : "");
      setEndDate(selectedEvent.end_date ? new Date(selectedEvent.end_date).toISOString().slice(0, 16) : "");
      setPaymentStatus(selectedEvent.payment_status || "not_paid");
      setPaymentAmount(selectedEvent.payment_amount?.toString() || "");
      setExistingFiles(selectedEvent.files || []);
      
      // Initialize recurring fields
      setIsRecurring(selectedEvent.is_recurring || false);
      setRepeatPattern(selectedEvent.repeat_pattern || '');
      setRepeatUntil(selectedEvent.repeat_until || '');
      
      // Initialize email reminder fields - NEW
      setEmailReminderEnabled(selectedEvent.email_reminder_enabled || false);
      setReminderAt(selectedEvent.reminder_at ? new Date(selectedEvent.reminder_at).toISOString().slice(0, 16) : undefined);
    } else if (selectedDate) {
      const defaultStart = new Date(selectedDate);
      defaultStart.setHours(9, 0, 0, 0);
      const defaultEnd = new Date(defaultStart);
      defaultEnd.setHours(10, 0, 0, 0);
      
      setStartDate(defaultStart.toISOString().slice(0, 16));
      setEndDate(defaultEnd.toISOString().slice(0, 16));
      
      // Reset all other fields for new events
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
      setRepeatPattern('');
      setRepeatUntil('');
      setEmailReminderEnabled(false);
      setReminderAt(undefined);
      setAdditionalPersons([]);
    }
  }, [selectedEvent, selectedDate]);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);

      // Validate reminder time if email reminder is enabled
      if (emailReminderEnabled && reminderAt && startDate) {
        const validationResult = await validateDateTime(
          new Date(reminderAt).toISOString(),
          'reminder',
          new Date(startDate).toISOString()
        );
        
        if (!validationResult.valid) {
          toast({
            title: t("common.error"),
            description: validationResult.message || "Reminder must be before event start time",
            variant: "destructive",
          });
          return;
        }
      }

      const eventData: Partial<CalendarEventType> = {
        title: userSurname || title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : '',
        repeat_until: isRecurring ? repeatUntil : '',
        // Add email reminder fields
        email_reminder_enabled: emailReminderEnabled,
        reminder_at: emailReminderEnabled && reminderAt ? new Date(reminderAt).toISOString() : undefined,
        reminder_sent_at: null // Reset when updating reminder
      };

      if (selectedEvent) {
        if (!updateEvent) throw new Error("Update function not available");
        await updateEvent(eventData);
      } else {
        if (!createEvent) throw new Error("Create function not available");
        await createEvent(eventData);
      }

      onClose();
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (!deleteEvent || !selectedEvent) return;
    
    try {
      await deleteEvent({ id: selectedEvent.id, deleteChoice });
      setIsRecurringDeleteOpen(false);
      onClose();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = () => {
    if (selectedEvent?.is_recurring || selectedEvent?.parent_event_id) {
      setIsRecurringDeleteOpen(true);
    } else {
      handleDelete();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <DialogTitle className={cn("text-xl font-semibold", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {selectedEvent 
                ? (isGeorgian ? <GeorgianAuthText>მოვლენის რედაქტირება</GeorgianAuthText> : <LanguageText>{t("events.editEvent")}</LanguageText>)
                : (isGeorgian ? <GeorgianAuthText>ახალი მოვლენა</GeorgianAuthText> : <LanguageText>{t("events.addEvent")}</LanguageText>)
              }
            </DialogTitle>
            <div className="flex items-center gap-2">
              {selectedEvent && deleteEvent && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleDeleteClick}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </AlertDialog>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
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
              isVirtualEvent={isVirtualEvent}
              // Pass email reminder props
              emailReminderEnabled={emailReminderEnabled}
              setEmailReminderEnabled={setEmailReminderEnabled}
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
            />

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button
                type="submit"
                disabled={isSubmitting || !userSurname.trim() || !startDate || !endDate}
                className="flex-1"
              >
                {isSubmitting 
                  ? (isGeorgian ? "მიმდინარეობს შენახვა..." : t("common.saving"))
                  : selectedEvent
                    ? (isGeorgian ? <GeorgianAuthText>შენახვა</GeorgianAuthText> : <LanguageText>{t("common.save")}</LanguageText>)
                    : (isGeorgian ? <GeorgianAuthText>შექმნა</GeorgianAuthText> : <LanguageText>{t("common.create")}</LanguageText>)
                }
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                {isGeorgian ? <GeorgianAuthText>გაუქმება</GeorgianAuthText> : <LanguageText>{t("common.cancel")}</LanguageText>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recurring Delete Dialog */}
      <RecurringDeleteDialog
        isOpen={isRecurringDeleteOpen}
        onClose={() => setIsRecurringDeleteOpen(false)}
        onDelete={handleDelete}
      />
    </>
  );
};
