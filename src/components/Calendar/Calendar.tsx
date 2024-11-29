import { EventDialog } from "./EventDialog";
import { CalendarContainer } from "./CalendarContainer";
import { useCalendarState } from "./hooks/useCalendarState";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { addHours } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

export const Calendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedSlot,
  } = useCalendarState();

  if (!user) {
    navigate("/signin");
    return null;
  }

  return (
    <div className="h-full">
      <CalendarContainer />

      <EventDialog
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={selectedSlot?.date || null}
        defaultEndDate={selectedSlot?.date ? addHours(selectedSlot.date, 1) : null}
        onSubmit={async (data) => {
          try {
            await createEvent(data);
            setIsNewEventDialogOpen(false);
            toast({
              title: "Success",
              description: "Event created successfully",
            });
          } catch (error: any) {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        }}
      />

      {selectedEvent && (
        <EventDialog
          open={!!selectedEvent}
          onOpenChange={() => setSelectedEvent(null)}
          selectedDate={new Date(selectedEvent.start_date)}
          event={selectedEvent}
          onSubmit={async (updates) => {
            try {
              await updateEvent({
                id: selectedEvent.id,
                updates,
              });
              setSelectedEvent(null);
              toast({
                title: "Success",
                description: "Event updated successfully",
              });
            } catch (error: any) {
              toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
              });
            }
          }}
          onDelete={async () => {
            try {
              await deleteEvent(selectedEvent.id);
              setSelectedEvent(null);
              toast({
                title: "Success",
                description: "Event deleted successfully",
              });
            } catch (error: any) {
              toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
              });
            }
          }}
        />
      )}
    </div>
  );
};