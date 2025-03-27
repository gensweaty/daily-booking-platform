
import { useState, useEffect } from "react";
import { format, addHours } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventDialogFields } from "./EventDialogFields";
import { CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Trash2, CheckCircle2 } from "lucide-react";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  event?: CalendarEventType;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onDelete?: (id: string) => Promise<void>;
  onApprove?: (id: string) => Promise<void>;
  isPublic?: boolean;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  event,
  onSubmit,
  onDelete,
  onApprove,
  isPublic = false,
}: EventDialogProps) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [eventType, setEventType] = useState<"birthday" | "private_party">("birthday");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    if (selectedDate) {
      setStartDate(selectedDate);
      setEndDate(addHours(selectedDate, 1));
    }

    if (event) {
      setTitle(event.title);
      setUserSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setStartDate(new Date(event.start_date));
      setEndDate(new Date(event.end_date));
      setEventType(event.type);
      setPaymentStatus(event.payment_status || "");
      setPaymentAmount(event.payment_amount || 0);
    } else {
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setPaymentStatus("");
      setPaymentAmount(0);
      setEventType("birthday");
    }
  }, [selectedDate, event, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    try {
      setIsSubmitting(true);
      const formattedData: Partial<CalendarEventType> = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        payment_status: paymentStatus,
        payment_amount: paymentAmount,
        type: eventType,
      };

      if (event) {
        // Update existing event
        await onSubmit(formattedData);
      } else {
        // Create new event
        await onSubmit(formattedData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    
    try {
      setIsDeleting(true);
      await onDelete(event.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting event:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApprove = async () => {
    if (!event || !onApprove) return;
    
    try {
      setIsApproving(true);
      await onApprove(event.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error approving event:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const isEditingDisabled = isPublic && event && (event.status === 'confirmed' || event.status === 'unconfirmed');
  const canApprove = !isPublic && event?.status === 'unconfirmed' && onApprove;

  // Format the dialog title based on context
  const getDialogTitle = () => {
    if (isPublic && !event) {
      return t("business.bookingRequest");
    } else if (event) {
      // Check if the event is unconfirmed (show different title for public and dashboard)
      if (event.status === 'unconfirmed') {
        return isPublic 
          ? t("business.pendingBooking") 
          : t("business.unconfirmedBooking");
      }
      return t("events.editEvent");
    }
    return t("events.addNewEvent");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            eventType={eventType}
            setEventType={setEventType}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            file={file}
            setFile={setFile}
            fileError={fileError}
            setFileError={setFileError}
            isEditingDisabled={isEditingDisabled}
            isPublic={isPublic}
          />

          <div className="flex justify-end gap-2 pt-4">
            {canApprove && (
              <Button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="mr-auto text-green-50 bg-green-600 hover:bg-green-700"
              >
                {isApproving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {t("business.approve")}
              </Button>
            )}
            
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isDeleting || isApproving}
            >
              {t("common.cancel")}
            </Button>
            
            {onDelete && event && !isPublic && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting || isApproving}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t("common.delete")}
              </Button>
            )}
            
            {/* Only show save button if not viewing a public event */}
            {(!isPublic || !event) && (
              <Button
                type="submit"
                disabled={isSubmitting || isDeleting || isApproving}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {event ? t("common.save") : t("common.create")}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
