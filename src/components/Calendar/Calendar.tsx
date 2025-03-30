
import { useState, useEffect } from "react";
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
  parseISO,
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
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";

interface CalendarProps {
  defaultView?: CalendarViewType;
  currentView?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
  isExternalCalendar?: boolean;
  businessId?: string;
  showAllEvents?: boolean;
}

export const Calendar = ({ 
  defaultView = "week", 
  currentView,
  onViewChange,
  isExternalCalendar = false,
  businessId,
  showAllEvents = false
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents(isExternalCalendar ? businessId : undefined);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Debug output
  console.log("Calendar Props:", { 
    defaultView, 
    isExternalCalendar, 
    businessId, 
    showAllEvents,
    eventsCount: events?.length
  });

  useEffect(() => {
    if (currentView) {
      setView(currentView);
    }
  }, [currentView]);

  useEffect(() => {
    const invalidateQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
    };
    
    invalidateQueries();
    const intervalId = setInterval(invalidateQueries, 5000); // Refresh every 5 seconds
    return () => clearInterval(intervalId);
  }, [queryClient, businessId]);

  const {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedDate: dialogSelectedDate,
    setSelectedDate: setDialogSelectedDate,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent: async (data) => {
      const result = await createEvent(data);
      return result;
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

  if (!isExternalCalendar && !user && !window.location.pathname.includes('/business/')) {
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

  const handleViewChange = (newView: CalendarViewType) => {
    setView(newView);
    if (onViewChange) {
      onViewChange(newView);
    }
  };

  const handleCalendarDayClick = (date: Date, hour?: number) => {
    if (isExternalCalendar) return;
    
    const clickedDate = new Date(date);
    clickedDate.setHours(hour || 9, 0, 0, 0);
    
    setDialogSelectedDate(clickedDate);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleAddEventClick = () => {
    if (isExternalCalendar) return;
    
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    setDialogSelectedDate(now);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleEventClick = (event: CalendarEventType) => {
    if (!isExternalCalendar) {
      setSelectedEvent(event);
    }
  };

  if (error) {
    console.error("Calendar error:", error);
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

  // Debug output for events
  console.log(`Rendering calendar with ${events?.length || 0} events`);
  if (events?.length > 0) {
    console.log("First few events:", events.slice(0, 3));
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <CalendarHeader
        selectedDate={selectedDate}
        view={view}
        onViewChange={handleViewChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={!isExternalCalendar ? handleAddEventClick : undefined}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={getDaysForView()}
            events={events || []}
            selectedDate={selectedDate}
            view={view}
            onDayClick={!isExternalCalendar ? handleCalendarDayClick : undefined}
            onEventClick={handleEventClick}
          />
        </div>
      </div>

      {!isExternalCalendar && (
        <>
          <EventDialog
            key={dialogSelectedDate?.getTime()}
            open={isNewEventDialogOpen}
            onOpenChange={setIsNewEventDialogOpen}
            selectedDate={dialogSelectedDate}
            onSubmit={handleCreateEvent}
          />

          {selectedEvent && (
            <EventDialog
              key={selectedEvent.id}
              open={!!selectedEvent}
              onOpenChange={() => setSelectedEvent(null)}
              selectedDate={new Date(selectedEvent.start_date)}
              event={selectedEvent}
              onSubmit={handleUpdateEvent}
              onDelete={handleDeleteEvent}
            />
          )}
        </>
      )}
    </div>
  );
};
