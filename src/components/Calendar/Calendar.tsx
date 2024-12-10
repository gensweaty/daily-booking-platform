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
  addHours,
  setHours,
  setMinutes,
} from "date-fns";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { CalendarViewType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarProps {
  defaultView?: CalendarViewType;
}

export const Calendar = ({ defaultView = "week" }: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedSlot,
    setSelectedSlot,
    handleDayClick,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog(createEvent, updateEvent, deleteEvent);

  if (!user) {
    navigate("/signin");
    return null;
  }

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

  const handleSlotSelect = (date: Date, hour?: number) => {
    const newDate = new Date(date);
    if (hour !== undefined) {
      newDate.setHours(hour, 0, 0, 0);
    } else {
      // For month view or when hour is not specified, default to 9 AM
      newDate.setHours(9, 0, 0, 0);
    }
    setSelectedSlot({ date: newDate });
    setSelectedEvent(null);
    setIsNewEventDialogOpen(true);
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
        onAddEvent={() => {
          const now = new Date();
          setSelectedSlot({ date: setHours(now, 9) });
          setSelectedEvent(null);
          setIsNewEventDialogOpen(true);
        }}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={getDaysForView()}
            events={events || []}
            selectedDate={selectedDate}
            view={view}
            onDayClick={handleSlotSelect}
            onEventClick={setSelectedEvent}
          />
        </div>
      </div>

      <EventDialog
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={selectedSlot?.date || null}
        defaultEndDate={selectedSlot?.date ? addHours(selectedSlot.date, 1) : null}
        onSubmit={handleCreateEvent}
      />

      {selectedEvent && (
        <EventDialog
          open={!!selectedEvent}
          onOpenChange={() => setSelectedEvent(null)}
          selectedDate={new Date(selectedEvent.start_date)}
          event={selectedEvent}
          onSubmit={handleUpdateEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  );
};