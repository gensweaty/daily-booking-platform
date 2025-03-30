
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
import { CalendarEventType as DatabaseCalendarEventType } from "@/types/database";

interface CalendarProps {
  defaultView?: CalendarViewType;
  isPublic?: boolean;
  publicBusinessId?: string;
  onDateSelected?: (date: Date) => void;
}

export const Calendar = ({ 
  defaultView = "week", 
  isPublic = false, 
  publicBusinessId,
  onDateSelected 
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const [publicEvents, setPublicEvents] = useState<DatabaseCalendarEventType[]>([]);
  const [isLoadingPublicEvents, setIsLoadingPublicEvents] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (typeof window !== 'undefined') {
    (window as any).__CALENDAR_EVENTS__ = isPublic ? publicEvents : events;
  }

  useEffect(() => {
    if (isPublic && publicBusinessId) {
      const fetchPublicEvents = async () => {
        setIsLoadingPublicEvents(true);
        try {
          console.log(`Fetching public events for business ID: ${publicBusinessId}`);
          
          const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('business_id', publicBusinessId)
            .order('start_date', { ascending: true });

          if (error) {
            console.error("Error fetching public events:", error);
            throw error;
          }
          
          console.log(`Fetched ${data?.length || 0} public events:`, data);
          setPublicEvents(data || []);
        } catch (err) {
          console.error('Error loading public events:', err);
        } finally {
          setIsLoadingPublicEvents(false);
        }
      };

      fetchPublicEvents();
    }
  }, [isPublic, publicBusinessId]);

  // Add a more frequent refresh interval for public events
  useEffect(() => {
    if (isPublic && publicBusinessId) {
      const refreshPublicEvents = async () => {
        try {
          console.log('Refreshing public events...');
          const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('business_id', publicBusinessId)
            .order('start_date', { ascending: true });

          if (error) throw error;
          console.log(`Refreshed ${data?.length || 0} public events`);
          setPublicEvents(data || []);
        } catch (err) {
          console.error('Error refreshing public events:', err);
        }
      };
      
      // Initial refresh
      refreshPublicEvents();
      
      // Set up polling
      const intervalId = setInterval(refreshPublicEvents, 10000); // Every 10 seconds
      
      return () => clearInterval(intervalId);
    }
  }, [isPublic, publicBusinessId]);

  useEffect(() => {
    if (!isPublic) {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      const intervalId = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['events'] });
      }, 15000);
      
      return () => clearInterval(intervalId);
    }
  }, [queryClient, isPublic]);

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
      const result = await createEvent(data as Partial<DatabaseCalendarEventType>);
      return result as unknown as CalendarEventType;
    },
    updateEvent: async (data) => {
      if (!selectedEvent) throw new Error("No event selected");
      const result = await updateEvent({
        id: selectedEvent.id,
        updates: data as Partial<DatabaseCalendarEventType>,
      });
      return result as unknown as CalendarEventType;
    },
    deleteEvent: async (id) => {
      await deleteEvent(id);
    }
  });

  if (!isPublic && !user) {
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
    if (isPublic && onDateSelected) {
      onDateSelected(date);
      return;
    }
    
    const clickedDate = new Date(date);
    clickedDate.setHours(hour || 9, 0, 0, 0);
    
    setDialogSelectedDate(clickedDate);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleAddEventClick = () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    setDialogSelectedDate(now);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  if (error && !isPublic) {
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if ((isLoading && !isPublic) || (isLoadingPublicEvents && isPublic)) {
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

  const displayEvents = isPublic ? publicEvents : events || [];
  
  console.log(`Calendar: Rendering with ${displayEvents.length} events, isPublic=${isPublic}, publicBusinessId=${publicBusinessId}`);
  
  return (
    <div className="h-full flex flex-col gap-4">
      <CalendarHeader
        selectedDate={selectedDate}
        view={view}
        onViewChange={setView}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={isPublic ? undefined : handleAddEventClick}
        isPublic={isPublic}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={getDaysForView()}
            events={displayEvents as CalendarEventType[]}
            selectedDate={selectedDate}
            view={view}
            onDayClick={handleCalendarDayClick}
            onEventClick={isPublic ? () => {} : (event) => setSelectedEvent(event as any)}
            isPublic={isPublic}
          />
        </div>
      </div>

      {!isPublic && (
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
