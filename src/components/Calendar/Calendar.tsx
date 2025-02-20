
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
  setHours,
  startOfDay,
} from "date-fns";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarProps {
  defaultView?: CalendarViewType;
}

interface DialogState {
  isOpen: boolean;
  date: Date | null;
  event: CalendarEventType | null;
}

export const Calendar = ({ defaultView = "week" }: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Separate dialog states
  const [newEventDialog, setNewEventDialog] = useState<DialogState>({
    isOpen: false,
    date: null,
    event: null,
  });

  const [editEventDialog, setEditEventDialog] = useState<DialogState>({
    isOpen: false,
    date: null,
    event: null,
  });

  // Make events available globally for the useEventDialog hook
  if (typeof window !== 'undefined') {
    (window as any).__CALENDAR_EVENTS__ = events;
  }

  const {
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent: async (data) => {
      const result = await createEvent(data);
      return result;
    },
    updateEvent: async (data) => {
      if (!editEventDialog.event) throw new Error("No event selected");
      const result = await updateEvent({
        id: editEventDialog.event.id,
        updates: data,
      });
      return result;
    },
    deleteEvent: async (id) => {
      await deleteEvent(id);
    }
  });

  if (!user) {
    navigate("/signin");
    return null;
  }

  const getDaysForView = () => {
    switch (view) {
      case "month": {
        const monthStart = startOfMonth(selectedDate);
        const firstWeekStart = startOfWeek(monthStart);
        const monthEnd = endOfMonth(selectedDate);
        return eachDayOfInterval({
          start: firstWeekStart,
          end: monthEnd,
        });
      }
      case "week":
        return eachDayOfInterval({
          start: startOfWeek(selectedDate),
          end: endOfWeek(selectedDate),
        });
      case "day":
        return [startOfDay(selectedDate)];
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

  const handleCalendarDayClick = (date: Date, hour?: number) => {
    const clickedDate = new Date(date);
    clickedDate.setHours(hour || 9, 0, 0, 0);
    
    // Close edit dialog if open
    setEditEventDialog({
      isOpen: false,
      date: null,
      event: null,
    });

    // Open new event dialog
    setNewEventDialog({
      isOpen: true,
      date: clickedDate,
      event: null,
    });
  };

  const handleAddEventClick = () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    // Close edit dialog if open
    setEditEventDialog({
      isOpen: false,
      date: null,
      event: null,
    });

    // Open new event dialog
    setNewEventDialog({
      isOpen: true,
      date: now,
      event: null,
    });
  };

  const handleEventClick = (event: CalendarEventType) => {
    console.log('Event clicked:', event);
    
    // Close new event dialog if open
    setNewEventDialog({
      isOpen: false,
      date: null,
      event: null,
    });

    // Open edit dialog
    setEditEventDialog({
      isOpen: true,
      date: new Date(event.start_date),
      event: event,
    });
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
        onAddEvent={handleAddEventClick}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={getDaysForView()}
            events={events || []}
            selectedDate={selectedDate}
            view={view}
            onDayClick={handleCalendarDayClick}
            onEventClick={handleEventClick}
          />
        </div>
      </div>

      {/* New Event Dialog */}
      {newEventDialog.isOpen && (
        <EventDialog
          key={`new-${newEventDialog.date?.getTime()}`}
          open={newEventDialog.isOpen}
          onOpenChange={(open) => {
            setNewEventDialog({
              isOpen: open,
              date: open ? newEventDialog.date : null,
              event: null,
            });
          }}
          selectedDate={newEventDialog.date}
          onSubmit={async (data) => {
            await handleCreateEvent(data);
            setNewEventDialog({
              isOpen: false,
              date: null,
              event: null,
            });
          }}
        />
      )}

      {/* Edit Event Dialog */}
      {editEventDialog.isOpen && editEventDialog.event && (
        <EventDialog
          key={`edit-${editEventDialog.event.id}`}
          open={editEventDialog.isOpen}
          onOpenChange={(open) => {
            setEditEventDialog({
              isOpen: open,
              date: open ? editEventDialog.date : null,
              event: open ? editEventDialog.event : null,
            });
          }}
          selectedDate={editEventDialog.date}
          event={editEventDialog.event}
          onSubmit={async (data) => {
            await handleUpdateEvent(data);
            setEditEventDialog({
              isOpen: false,
              date: null,
              event: null,
            });
          }}
          onDelete={async () => {
            if (editEventDialog.event) {
              await handleDeleteEvent(editEventDialog.event.id);
              setEditEventDialog({
                isOpen: false,
                date: null,
                event: null,
              });
            }
          }}
        />
      )}
    </div>
  );
};
