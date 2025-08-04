import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { useLazyFileLoader } from "@/hooks/useLazyFileLoader";
import { FileRecord } from "@/types/files";

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSave: (event: Partial<CalendarEventType>) => Promise<void>;
  onDelete?: (id: string, deleteChoice?: "this" | "series") => Promise<void>;
  event?: CalendarEventType;
  businessId?: string;
  isNewEvent?: boolean;
}

export const EventDialog = ({
  isOpen,
  onClose,
  selectedDate,
  onSave,
  onDelete,
  event,
  businessId,
  isNewEvent = true
}: EventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventName, setEventName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Add email reminder state variables
  const [reminderAt, setReminderAt] = useState<Date | null>(null);
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);

  const { 
    displayedFiles, 
    loadFiles,
    handleFileDeleted
  } = useLazyFileLoader({
    parentType: 'event',
    bucketName: 'event_attachments',
    fallbackBuckets: ['booking_attachments']
  });

  // Load event data when editing
  useEffect(() => {
    if (event) {
      setUserSurname(event.user_surname || event.title || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setEventName(event.event_name || "");
      setPaymentStatus(event.payment_status || "not_paid");
      setPaymentAmount(event.payment_amount?.toString() || "");
      
      // Load email reminder fields
      setReminderAt(event.reminder_at ? new Date(event.reminder_at) : null);
      setEmailReminderEnabled(event.email_reminder_enabled || false);

      if (event.id) {
        loadFiles(event.id, event.title);
      }
    } else {
      // Reset form for new events
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setReminderAt(null);
      setEmailReminderEnabled(false);
      setSelectedFile(null);
      setFileError("");
    }
  }, [event, loadFiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setFileError("");

    try {
      const eventData: Partial<CalendarEventType> = {
        title: userSurname || "Untitled Event",
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: selectedDate.toISOString(),
        end_date: new Date(selectedDate.getTime() + 60 * 60 * 1000).toISOString(),
        payment_status: paymentStatus as any,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        user_id: user.id,
        type: "event",
        file: selectedFile || undefined,
        // Add email reminder fields
        reminder_at: reminderAt?.toISOString() || undefined,
        email_reminder_enabled: emailReminderEnabled,
      };

      if (event) {
        eventData.id = event.id;
      }

      await onSave(eventData);
      onClose();
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("events.errorSavingEvent"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (!event?.id || !onDelete) return;

    setIsLoading(true);
    try {
      await onDelete(event.id, deleteChoice);
      setShowDeleteDialog(false);
      onClose();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("events.errorDeletingEvent"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (event?.is_recurring) {
      setShowDeleteDialog(true);
    } else {
      handleDelete();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNewEvent ? t("events.addNewEvent") : t("events.editEvent")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <EventDialogFields
              selectedDate={selectedDate}
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
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              eventId={event?.id}
              displayedFiles={displayedFiles}
              onFileDeleted={handleFileDeleted}
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
              emailReminderEnabled={emailReminderEnabled}
              setEmailReminderEnabled={setEmailReminderEnabled}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? t("common.saving") : t("common.save")}
              </Button>
              
              {event && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteClick}
                  disabled={isLoading}
                >
                  {t("common.delete")}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {showDeleteDialog && event && (
        <RecurringDeleteDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onDelete={handleDelete}
          isRecurring={event.is_recurring || false}
        />
      )}
    </>
  );
};
