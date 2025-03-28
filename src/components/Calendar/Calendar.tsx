
// We only need to update a small part of this file to pass business_id to the events

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
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface CalendarProps {
  defaultView?: CalendarViewType;
  publicMode?: boolean;
  externalEvents?: CalendarEventType[];
  businessId?: string;
}

export const Calendar = ({ 
  defaultView = "week", 
  publicMode = false,
  externalEvents,
  businessId
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Make events available globally for the useEventDialog hook
  if (typeof window !== 'undefined') {
    (window as any).__CALENDAR_EVENTS__ = events;
  }

  const {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedDate: dialogSelectedDate,
    setSelectedDate: setDialogSelectedDate,
    handleCreateEvent: originalHandleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent: async (data) => {
      try {
        // Handle public booking requests
        if (publicMode && businessId) {
          data.business_id = businessId;
          const result = await createEvent(data);
          toast({
            title: "Booking Request Sent",
            description: "Your booking request has been submitted successfully!",
          });
          return result;
        }
        
        // Regular event creation
        const result = await createEvent(data);
        return result;
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to create event",
          variant: "destructive",
        });
        throw error;
      }
    },
    updateEvent: async (data) => {
      if (!selectedEvent) throw new Error("No event selected");
      const result = await updateEvent({
        id: selectedEvent.id,
        updates: data,
      });
      return result;
    },
    deleteEvent: async (id) => {
      await deleteEvent(id);
    }
  });

  // In public mode, we don't require authentication
  if (!publicMode && !user) {
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
    
    // First set the date
    setDialogSelectedDate(clickedDate);
    // Then open the dialog
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleAddEventClick = () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    // First set the date
    setDialogSelectedDate(now);
    // Then open the dialog
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  // Use external events in public mode if provided
  const displayEvents = publicMode && externalEvents ? externalEvents : events || [];

  if (error && !publicMode) {
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if (isLoading && !publicMode && !externalEvents) {
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
        onAddEvent={!publicMode ? handleAddEventClick : undefined}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={getDaysForView()}
            events={displayEvents}
            selectedDate={selectedDate}
            view={view}
            onDayClick={publicMode ? handleCalendarDayClick : handleCalendarDayClick}
            onEventClick={!publicMode ? setSelectedEvent : () => {}}
            publicMode={publicMode}
          />
        </div>
      </div>

      {!publicMode && (
        <>
          <EventDialog
            key={dialogSelectedDate?.getTime()} // Force re-render when date changes
            open={isNewEventDialogOpen}
            onOpenChange={setIsNewEventDialogOpen}
            selectedDate={dialogSelectedDate}
            onSubmit={originalHandleCreateEvent}
            businessId={businessId}
          />

          {selectedEvent && (
            <EventDialog
              key={selectedEvent.id} // Force re-render when event changes
              open={!!selectedEvent}
              onOpenChange={() => setSelectedEvent(null)}
              selectedDate={new Date(selectedEvent.start_date)} // Use the actual event start date
              event={selectedEvent}
              onSubmit={handleUpdateEvent}
              onDelete={handleDeleteEvent}
              businessId={businessId}
            />
          )}
        </>
      )}
      
      {publicMode && isNewEventDialogOpen && dialogSelectedDate && (
        <EventDialog
          key={dialogSelectedDate?.getTime()} // Force re-render when date changes
          open={isNewEventDialogOpen}
          onOpenChange={setIsNewEventDialogOpen}
          selectedDate={dialogSelectedDate}
          onSubmit={originalHandleCreateEvent}
          businessId={businessId}
        />
      )}
    </div>
  );
};
