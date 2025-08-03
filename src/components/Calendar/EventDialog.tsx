
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { EventDialogFields } from "./EventDialogFields";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { useEventDialog } from "./hooks/useEventDialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

export interface EventDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  selectedDate: Date;
  initialData?: CalendarEventType;
  onEventCreated?: () => Promise<void>;
  onEventUpdated?: () => Promise<void>;
  onEventDeleted?: () => Promise<void>;
}

// Define PersonData interface consistent with EventDialogFields
interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: "not_paid" | "partly_paid" | "fully_paid";
  paymentAmount: string;
}

export const EventDialog = ({ 
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  selectedDate, 
  initialData, 
  onEventCreated, 
  onEventUpdated, 
  onEventDeleted 
}: EventDialogProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isGeorgian = language === 'ka';

  // State management
  const [internalOpen, setInternalOpen] = useState(!!initialData);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [emailReminder, setEmailReminder] = useState(false);
  
  // Other existing state variables...
  const [userSurname, setUserSurname] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"not_paid" | "partly_paid" | "fully_paid">("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<"weekly" | "monthly">("weekly");
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent
  } = useEventDialog({
    createEvent: async (data) => {
      // Implementation will be handled by the hook
      return data as CalendarEventType;
    },
    updateEvent: async (data) => {
      // Implementation will be handled by the hook
      return data as CalendarEventType;
    },
    deleteEvent: async ({ id, deleteChoice }) => {
      // Implementation will be handled by the hook
      return { success: true };
    }
  });

  // Initialize form when editing
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setStartDate(initialData.start_date || "");
      setEndDate(initialData.end_date || "");
      setReminderAt(initialData.reminder_at || "");
      setEmailReminder(initialData.email_reminder_enabled || false);
      setUserSurname(initialData.user_surname || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      
      // Properly cast payment status with validation
      const paymentStatusValue = initialData.payment_status;
      if (paymentStatusValue === "not_paid" || paymentStatusValue === "partly_paid" || paymentStatusValue === "fully_paid") {
        setPaymentStatus(paymentStatusValue);
      } else {
        setPaymentStatus("not_paid");
      }
      
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setEventNotes(initialData.event_notes || "");
      setIsRecurring(!!initialData.recurring_type);
      if (initialData.recurring_type) {
        setRecurringType(initialData.recurring_type as "weekly" | "monthly");
      }
      setRecurringEndDate(initialData.recurring_end_date || "");
      
      // Properly transform additional_persons with proper type casting and validation
      const transformedPersons: PersonData[] = (initialData.additional_persons || []).map(person => {
        // Validate and cast payment status
        let validPaymentStatus: "not_paid" | "partly_paid" | "fully_paid" = "not_paid";
        if (person.paymentStatus === "not_paid" || person.paymentStatus === "partly_paid" || person.paymentStatus === "fully_paid") {
          validPaymentStatus = person.paymentStatus;
        }
        
        return {
          id: person.id,
          userSurname: person.userSurname,
          userNumber: person.userNumber,
          socialNetworkLink: person.socialNetworkLink,
          eventNotes: person.eventNotes,
          paymentStatus: validPaymentStatus,
          paymentAmount: person.paymentAmount,
        };
      });
      setAdditionalPersons(transformedPersons);
      
      if (externalOpen === undefined) {
        setInternalOpen(true);
      }
    } else {
      // Reset form for new event
      resetForm();
      if (externalOpen === undefined) {
        setInternalOpen(true);
      }
    }
  }, [initialData, externalOpen]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setReminderAt("");
    setEmailReminder(false);
    setUserSurname("");
    setSocialNetworkLink("");
    setPaymentStatus("not_paid");
    setPaymentAmount("");
    setEventNotes("");
    setAdditionalPersons([]);
    setIsRecurring(false);
    setRecurringType("weekly");
    setRecurringEndDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const eventData = {
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        reminder_at: reminderAt,
        email_reminder_enabled: emailReminder,
        user_surname: userSurname,
        social_network_link: socialNetworkLink,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        event_notes: eventNotes,
        additional_persons: additionalPersons,
        is_recurring: isRecurring,
        recurring_type: isRecurring ? recurringType : undefined,
        recurring_end_date: recurringEndDate,
      };

      if (initialData) {
        await handleUpdateEvent(eventData);
        if (onEventUpdated) await onEventUpdated();
      } else {
        await handleCreateEvent(eventData);
        if (onEventCreated) await onEventCreated();
      }
      setOpen(false);
    } catch (error) {
      console.error('Error submitting event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async (deleteChoice: "this" | "series") => {
    setDeleteDialogOpen(false);
    try {
      await handleDeleteEvent({ id: initialData?.id || '', deleteChoice });
      if (onEventDeleted) await onEventDeleted();
      setOpen(false);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {initialData ? t('calendar.editEvent') : t('calendar.createEvent')}
            </DialogTitle>
            <DialogDescription>
              {initialData ? t('calendar.editEventDescription') : t('calendar.createEventDescription')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <EventDialogFields
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
              emailReminder={emailReminder}
              setEmailReminder={setEmailReminder}
              userSurname={userSurname}
              setUserSurname={setUserSurname}
              userNumber=""
              setUserNumber={() => {}}
              socialNetworkLink={socialNetworkLink}
              setSocialNetworkLink={setSocialNetworkLink}
              paymentStatus={paymentStatus}
              setPaymentStatus={setPaymentStatus}
              paymentAmount={paymentAmount}
              setPaymentAmount={setPaymentAmount}
              eventNotes={eventNotes}
              setEventNotes={setEventNotes}
              eventName=""
              setEventName={() => {}}
              files={[]}
              setFiles={() => {}}
              existingFiles={[]}
              setExistingFiles={() => {}}
              additionalPersons={additionalPersons}
              setAdditionalPersons={setAdditionalPersons}
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              repeatPattern=""
              setRepeatPattern={() => {}}
              repeatUntil={recurringEndDate}
              setRepeatUntil={setRecurringEndDate}
              isNewEvent={!initialData}
              selectedDate={selectedDate}
              initialData={initialData}
            />

            <div className="flex justify-end gap-2 pt-4 border-t">
              {initialData && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteClick}
                >
                  {t('common.delete')}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="bold">
                    <LanguageText>
                      {isSubmitting 
                        ? t('common.saving') 
                        : (initialData ? t('common.update') : t('common.create'))
                      }
                    </LanguageText>
                  </GeorgianAuthText>
                ) : (
                  <LanguageText>
                    {isSubmitting 
                      ? t('common.saving') 
                      : (initialData ? t('common.update') : t('common.create'))
                    }
                  </LanguageText>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleteThis={() => handleConfirmDelete("this")}
        onDeleteSeries={() => handleConfirmDelete("series")}
        isRecurringEvent={isRecurring}
      />
    </>
  );
};
