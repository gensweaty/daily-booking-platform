import { useState } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvents, createEvent, updateEvent } from "@/lib/api";
import { CalendarEvent } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { EventDialog } from "./EventDialog";

export const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: "Success", description: "Event created successfully" });
      setIsNewEventDialogOpen(false);
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CalendarEvent> }) =>
      updateEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: "Success", description: "Event updated successfully" });
      setSelectedEvent(null);
    },
  });

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

  const handleDayClick = (date: Date) => {
    setSelectedSlot(date);
    setIsNewEventDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  if (isLoading) return <div>Loading calendar...</div>;

  const days = getDaysForView();

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

      <CalendarGrid
        days={days}
        events={events}
        selectedDate={selectedDate}
        onDayClick={handleDayClick}
        onEventClick={handleEventClick}
      />

      <EventDialog
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={selectedSlot}
        onSubmit={(data) => createEventMutation.mutate(data)}
      />

      {selectedEvent && (
        <EventDialog
          open={!!selectedEvent}
          onOpenChange={() => setSelectedEvent(null)}
          selectedDate={new Date(selectedEvent.start_date)}
          event={selectedEvent}
          onSubmit={(updates) =>
            updateEventMutation.mutate({
              id: selectedEvent.id,
              updates,
            })
          }
        />
      )}
    </div>
  );
};