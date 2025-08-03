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
  selectedDate: Date;
  initialData?: CalendarEventType;
  onEventCreated?: () => Promise<void>;
  onEventUpdated?: () => Promise<void>;
  onEventDeleted?: () => Promise<void>;
}

export const EventDialog = ({ 
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
  const [open, setOpen] = useState(!!initialData);
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
  const [additionalPersons, setAdditionalPersons] = useState<Array<{
    name: string;
    socialNetworkLink: string;
    paymentStatus: "not_paid" | "partly_paid" | "fully_paid";
    paymentAmount: string;
  }>>([]);
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
    title,
    description, 
    startDate,
    endDate,
    reminderAt,
    emailReminder,
    userSurname,
    socialNetworkLink,
    paymentStatus,
    paymentAmount,
    eventNotes,
    additionalPersons,
    isRecurring,
    recurringType,
    recurringEndDate,
    selectedDate,
    initialData,
    onEventCreated,
    onEventUpdated,
    onEventDeleted,
    onClose: () => setOpen(false)
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
      setPaymentStatus(initialData.payment_status || "not_paid");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setEventNotes(initialData.event_notes || "");
      setIsRecurring(!!initialData.recurring_type);
      if (initialData.recurring_type) {
        setRecurringType(initialData.recurring_type as "weekly" | "monthly");
      }
      setRecurringEndDate(initialData.recurring_end_date || "");
      setAdditionalPersons(initialData.additional_persons || []);
      setOpen(true);
    } else {
      // Reset form for new event
      resetForm();
      setOpen(true);
    }
  }, [initialData]);

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
      if (initialData) {
        await handleUpdateEvent();
      } else {
        await handleCreateEvent();
      }
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
    await handleDeleteEvent(deleteChoice);
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
              socialNetworkLink={socialNetworkLink}
              setSocialNetworkLink={setSocialNetworkLink}
              paymentStatus={paymentStatus}
              setPaymentStatus={setPaymentStatus}
              paymentAmount={paymentAmount}
              setPaymentAmount={setPaymentAmount}
              eventNotes={eventNotes}
              setEventNotes={setEventNotes}
              additionalPersons={additionalPersons}
              setAdditionalPersons={setAdditionalPersons}
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              recurringType={recurringType}
              setRecurringType={setRecurringType}
              recurringEndDate={recurringEndDate}
              setRecurringEndDate={setRecurringEndDate}
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
        onConfirm={handleConfirmDelete}
        eventTitle={title}
        isRecurring={isRecurring}
        isVirtualInstance={!!initialData?.virtual_instance_id}
      />
    </>
  );
};
