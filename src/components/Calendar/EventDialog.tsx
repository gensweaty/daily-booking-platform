import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { useEventFormHandler } from "./EventFormHandler";
import { format, isValid, parseISO } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultEndDate?: Date | null;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType | undefined>;
  onDelete?: () => void;
  event?: CalendarEventType;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  onDelete,
  event,
}: EventDialogProps) => {
  const [title, setTitle] = useState(event?.title || "");
  const [userNumber, setUserNumber] = useState(event?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(event?.social_network_link || "");
  const [eventNotes, setEventNotes] = useState(event?.event_notes || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(event?.payment_status || "");
  const [paymentAmount, setPaymentAmount] = useState(event?.payment_amount?.toString() || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (event) {
      try {
        const start = new Date(event.start_date);
        const end = new Date(event.end_date);
        
        if (!isValid(start) || !isValid(end)) {
          throw new Error("Invalid date in event");
        }
        
        setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
        setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
      } catch (error) {
        console.error("Error parsing event dates:", error);
        toast({
          title: "Error",
          description: "Invalid date format in event",
          variant: "destructive",
        });
      }
    } else if (selectedDate) {
      try {
        const start = new Date(selectedDate);
        const end = new Date(selectedDate);
        end.setHours(start.getHours() + 1);
        
        if (!isValid(start) || !isValid(end)) {
          throw new Error("Invalid selected date");
        }
        
        setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
        setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
      } catch (error) {
        console.error("Error setting initial dates:", error);
        toast({
          title: "Error",
          description: "Invalid date format",
          variant: "destructive",
        });
      }
    }
  }, [selectedDate, event, toast]);

  const validateDates = () => {
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      
      if (!isValid(start) || !isValid(end)) {
        toast({
          title: "Error",
          description: "Please enter valid dates",
          variant: "destructive",
        });
        return false;
      }
      
      if (end < start) {
        toast({
          title: "Error",
          description: "End date must be after start date",
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Date validation error:", error);
      toast({
        title: "Error",
        description: "Invalid date format",
        variant: "destructive",
      });
      return false;
    }
  };

  const eventData = {
    title,
    user_number: userNumber,
    social_network_link: socialNetworkLink,
    event_notes: eventNotes,
    start_date: startDate ? new Date(startDate).toISOString() : undefined,
    end_date: endDate ? new Date(endDate).toISOString() : undefined,
    payment_status: paymentStatus || null,
    payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
  };

  const { handleSubmit, isSubmitting } = useEventFormHandler({
    onSubmit: async (data) => {
      if (!validateDates()) {
        return;
      }
      return onSubmit(data);
    },
    onSuccess: () => onOpenChange(false),
    selectedFile,
    setFileError,
    eventData,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{event ? "Edit Event" : "Add New Event"}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <EventDialogFields
            title={title}
            setTitle={setTitle}
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
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            eventId={event?.id}
          />
          
          <div className="flex justify-between gap-4">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {event ? "Update Event" : "Create Event"}
            </Button>
            {event && onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};