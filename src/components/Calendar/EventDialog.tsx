import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { EventFiles } from "./EventFiles";
import { useToast } from "../ui/use-toast";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultEndDate?: Date | null;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
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
  const [userSurname, setUserSurname] = useState(event?.user_surname || "");
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

  // Initialize dates when the dialog opens or event changes
  useState(() => {
    if (event) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    } else if (selectedDate) {
      const start = new Date(selectedDate);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    try {
      console.log("Submitting event data...");
      const eventData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        payment_status: paymentStatus || null,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
      };

      const savedEvent = await onSubmit(eventData);
      console.log("Event saved:", savedEvent);
      
      toast({
        title: "Success",
        description: event ? "Event updated successfully" : "Event created successfully",
      });
    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>{event ? "Edit Event" : "Add New Event"}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
          />
          
          {event?.id && (
            <EventFiles eventId={event.id} />
          )}
          
          <div className="flex justify-between gap-4">
            <Button type="submit" className="flex-1">
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