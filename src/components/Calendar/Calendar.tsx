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
  const [approvedBookings, setApprovedBookings] = useState<CalendarEventType[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (currentView) {
      setView(currentView);
    }
  }, [currentView]);

  if (typeof window !== 'undefined') {
    (window as any).__CALENDAR_EVENTS__ = events;
  }

  useEffect(() => {
    const invalidateQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
    };
    
    invalidateQueries();
    const intervalId = setInterval(invalidateQueries, 15000);
    return () => clearInterval(intervalId);
  }, [queryClient, businessId]);

  useEffect(() => {
    const fetchApprovedBookings = async () => {
      setIsLoadingBookings(true);
      try {
        let targetBusinessId = businessId;
        
        if (!isExternalCalendar && user?.id) {
          const { data: businessProfile } = await supabase
            .from("business_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
            
          if (businessProfile?.id) {
            targetBusinessId = businessProfile.id;
          }
        }
        
        if (!targetBusinessId && !user?.id) {
          setIsLoadingBookings(false);
          return;
        }
        
        const { data, error } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('status', 'approved');
          
        if (error) throw error;
        
        let filteredData = data;
        
        if (targetBusinessId) {
          filteredData = data.filter((booking: BookingRequest) => 
            booking.business_id === targetBusinessId
          );
        } else if (user?.id) {
          filteredData = data.filter((booking: BookingRequest) => 
            booking.user_id === user.id
          );
        }
        
        console.log("Fetched booking requests:", filteredData);
        
        const bookingEvents: CalendarEventType[] = (filteredData || []).map((booking: BookingRequest) => ({
          id: booking.id,
          title: booking.title,
          start_date: booking.start_date,
          end_date: booking.end_date,
          type: 'booking_request',
          user_id: booking.user_id || '',
          created_at: booking.created_at,
          requester_name: booking.requester_name,
          requester_email: booking.requester_email,
        }));
        
        setApprovedBookings(bookingEvents);
      } catch (error) {
        console.error('Error fetching approved bookings:', error);
      } finally {
        setIsLoadingBookings(false);
      }
    };
    
    fetchApprovedBookings();
    
    const intervalId = setInterval(fetchApprovedBookings, 15000);
    return () => clearInterval(intervalId);
  }, [user?.id, isExternalCalendar, businessId]);
  
  const allEvents = [...(events || []), ...approvedBookings];

  console.log("Calendar props:", { isExternalCalendar, businessId, showAllEvents });
  console.log("Events from useCalendarEvents:", events?.length || 0);
  console.log("Approved bookings:", approvedBookings.length);
  console.log("Combined events to display:", allEvents.length);

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
    if (!isExternalCalendar && !approvedBookings.some(booking => booking.id === event.id)) {
      setSelectedEvent(event);
    }
  };

  if (error) {
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if (isLoading || isLoadingBookings) {
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
            events={allEvents}
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
