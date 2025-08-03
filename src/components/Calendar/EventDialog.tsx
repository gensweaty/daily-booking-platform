
import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventDialogFields } from "./EventDialogFields";
import { ReminderField } from "@/components/shared/ReminderField";
import { useToast } from "@/hooks/use-toast";
import type { CalendarEventType } from "@/lib/types";

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (eventData: any) => void;
  onDelete?: (eventId: string, deleteAll?: boolean) => void;
  initialData?: CalendarEventType;
  selectedDate?: Date;
  mode?: 'create' | 'edit';
}

export const EventDialog: React.FC<EventDialogProps> = ({
  open,
  onClose,
  onSave,
  onDelete,
  initialData,
  selectedDate,
  mode = 'create'
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [deleteAllRecurring, setDeleteAllRecurring] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [title, setTitle] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [userNumber, setUserNumber] = useState('');
  const [socialNetworkLink, setSocialNetworkLink] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState('');
  const [repeatUntil, setRepeatUntil] = useState('');
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

  // ✅ FIX: Correct timezone handling - no double conversion
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setUserSurname(initialData.user_surname || '');
      setUserNumber(initialData.user_number || '');
      setSocialNetworkLink(initialData.social_network_link || '');
      setEventNotes(initialData.event_notes || '');
      setEventName(initialData.event_name || '');
      setPaymentStatus(initialData.payment_status || '');
      setPaymentAmount(initialData.payment_amount?.toString() || '');
      setIsRecurring(initialData.is_recurring || false);
      setRepeatPattern(initialData.repeat_pattern || '');
      setRepeatUntil(initialData.repeat_until || '');

      // ✅ FIX: Load dates without timezone conversion - just slice to get local format
      if (initialData.start_date) {
        setStartDate(initialData.start_date.slice(0, 16));
      }
      
      if (initialData.end_date) {
        setEndDate(initialData.end_date.slice(0, 16));
      }
      
      // ✅ FIX: Load reminder properly
      if (initialData.reminder_at) {
        setReminderAt(initialData.reminder_at.slice(0, 16));
      } else {
        setReminderAt('');
      }
      
      // ✅ FIX: Check both possible reminder enabled fields
      setEmailReminderEnabled(!!(initialData.email_reminder_enabled || initialData.reminder_enabled));

      // Load additional persons if they exist
      if (initialData.additional_persons) {
        setAdditionalPersons(initialData.additional_persons);
      }

      // Load files if they exist
      if (initialData.files) {
        setExistingFiles(initialData.files);
      }
      
    } else if (selectedDate && open) {
      // New event with selected date
      const dateStr = selectedDate.toISOString().slice(0, 16);
      setStartDate(dateStr);
      const endDateTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);
      setEndDate(endDateTime.toISOString().slice(0, 16));
      
      // Reset reminder fields for new event
      setReminderAt('');
      setEmailReminderEnabled(false);
    }
  }, [initialData, selectedDate, open]);

  const handleSave = async () => {
    try {
      if (!title.trim()) {
        toast({
          title: t("error.title"),
          description: "Title is required",
          variant: "destructive",
        });
        return;
      }

      if (!startDate || !endDate) {
        toast({
          title: t("error.title"),
          description: "Start date and end date are required",
          variant: "destructive",
        });
        return;
      }

      // ✅ FIX: Convert local datetime to UTC ISO string for storage
      const startISO = new Date(startDate).toISOString();
      const endISO = new Date(endDate).toISOString();
      const reminderISO = reminderAt ? new Date(reminderAt).toISOString() : null;

      // Validate reminder time if enabled
      if (emailReminderEnabled) {
        if (!reminderISO) {
          toast({
            title: t("error.title"),
            description: "Reminder time is required when email reminder is enabled",
            variant: "destructive",
          });
          return;
        }

        if (new Date(reminderISO) >= new Date(startISO)) {
          toast({
            title: t("error.title"),
            description: "Reminder time must be before event start time",
            variant: "destructive",
          });
          return;
        }
      }

      const eventData = {
        id: initialData?.id,
        title: title.trim(),
        user_surname: userSurname.trim(),
        user_number: userNumber.trim(),
        social_network_link: socialNetworkLink.trim(),
        event_notes: eventNotes.trim(),
        event_name: eventName.trim(),
        start_date: startISO,
        end_date: endISO,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
        reminder_at: reminderISO,
        email_reminder_enabled: emailReminderEnabled,
        type: 'event',
        additional_persons: additionalPersons,
        files: files
      };

      console.log('Saving event with data:', {
        ...eventData,
        reminderDebug: {
          reminderAt,
          reminderISO,
          emailReminderEnabled
        }
      });

      await onSave(eventData);
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: t("error.title"),
        description: "Failed to save event",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (deleteAll: boolean = false) => {
    if (initialData?.id && onDelete) {
      try {
        await onDelete(initialData.id, deleteAll);
        toast({
          title: t("success.title"),
          description: t("calendar.eventDeleted"),
        });
        onClose();
      } catch (error) {
        console.error("Error deleting event:", error);
        toast({
          title: t("error.title"),
          description: t("calendar.eventDeleteError"),
          variant: "destructive",
        });
      }
    }
  };

  const confirmDelete = (eventId: string, deleteAll: boolean = false) => {
    setDeleteEventId(eventId);
    setDeleteAllRecurring(deleteAll);
    setIsDeleteOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteOpen(false);
    setDeleteEventId(null);
    setDeleteAllRecurring(false);
  };

  const handleConfirmDelete = async () => {
    if (deleteEventId) {
      await handleDelete(deleteAllRecurring);
      closeDeleteDialog();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'edit' ? t("calendar.editEvent") : t("calendar.addEvent")}
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
              eventId={initialData?.id}
              isNewEvent={mode === 'create'}
              additionalPersons={additionalPersons}
              setAdditionalPersons={setAdditionalPersons}
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
              emailReminderEnabled={emailReminderEnabled}
              setEmailReminderEnabled={setEmailReminderEnabled}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            {mode === 'edit' && onDelete && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
              >
                {t("common.delete")}
              </Button>
            )}
            <Button onClick={handleSave}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.deleteConfirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("calendar.deleteThisEvent")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowDeleteDialog(false);
              if (initialData?.is_recurring) {
                confirmDelete(initialData.id, true);
              } else {
                confirmDelete(initialData.id);
              }
            }}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.deleteConfirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAllRecurring
                ? t("calendar.deleteAllRecurring")
                : t("calendar.deleteThisEvent")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
