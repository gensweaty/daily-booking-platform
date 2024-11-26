import { useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { CalendarViewType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const { toast } = useToast();

  const getDaysForView = () => {
    switch (view) {
      case "month":
        return eachDayOfInterval({
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate),
        });
      case "week":
        return eachDayOfInterval({
          start: startOfWeek(selectedDate),
          end: endOfWeek(selectedDate),
        });
      case "day":
        return [selectedDate];
    }
  };

  const handlePrevious = () => {
    switch (view) {
      case "month":
        setSelectedDate(subMonths(selectedDate, 1));
        break;
      case "week":
        setSelectedDate(addDays(selectedDate, -7));
        break;
      case "day":
        setSelectedDate(addDays(selectedDate, -1));
        break;
    }
  };

  const handleNext = () => {
    switch (view) {
      case "month":
        setSelectedDate(addMonths(selectedDate, 1));
        break;
      case "week":
        setSelectedDate(addDays(selectedDate, 7));
        break;
      case "day":
        setSelectedDate(addDays(selectedDate, 1));
        break;
    }
  };

  if (error) {
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <CalendarHeader
        selectedDate={selectedDate}
        view={view}
        onViewChange={setView}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={() => setIsNewEventDialogOpen(true)}
      />

      <CalendarView
        days={getDaysForView()}
        events={events || []}
        selectedDate={selectedDate}
        onDayClick={(date) => {
          setSelectedSlot(date);
          setIsNewEventDialogOpen(true);
        }}
        onEventClick={setSelectedEvent}
      />

      <EventDialog
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={selectedSlot}
        onSubmit={async (data) => {
          try {
            await createEvent(data);
            setIsNewEventDialogOpen(false);
            toast({
              title: "Success",
              description: "Event created successfully",
            });
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to create event",
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
            } catch (error) {
              toast({
                title: "Error",
                description: "Failed to update event",
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
            } catch (error) {
              toast({
                title: "Error",
                description: "Failed to delete event",
                variant: "destructive",
              });
            }
          }}
        />
      )}
    </div>
  );
};