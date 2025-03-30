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
  isExternalCalendar?: boolean;
  businessId?: string;
  showAllEvents?: boolean;
}

export const Calendar = ({ 
  defaultView = "week", 
  isExternalCalendar = false,
  businessId,
  showAllEvents = false
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const [approvedBookings, setApprovedBookings] = useState<CalendarEventType[]>([]);
  const [regularEvents, setRegularEvents] = useState<CalendarEventType[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Make events available globally for the useEventDialog hook
  if (typeof window !== 'undefined') {
    (window as any).__CALENDAR_EVENTS__ = events;
  }

  // Regular refresh for sync purposes
  useEffect(() => {
    // Initial fetch
    queryClient.invalidateQueries({ queryKey: ['events'] });
    
    // Set up regular refresh interval
    const intervalId = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }, 15000); // Refresh every 15 seconds
    
    return () => clearInterval(intervalId);
  }, [queryClient]);

  // Fetch regular events for both calendars when showAllEvents is true
  useEffect(() => {
    const fetchRegularEvents = async () => {
      if (!showAllEvents || !businessId) return;
      
      try {
        const { data: businessProfile } = await supabase
          .from("business_profiles")
          .select("user_id")
          .eq("id", businessId)
          .single();
          
        if (!businessProfile?.user_id) return;
          
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessProfile.user_id)
          .order('start_date', { ascending: true });
          
        if (error) throw error;
        
        setRegularEvents(data || []);
      } catch (error) {
        console.error('Error fetching regular events:', error);
      }
    };
    
    fetchRegularEvents();
  }, [businessId, showAllEvents]);

  // Fetch approved booking requests
  useEffect(() => {
    const fetchApprovedBookings = async () => {
      setIsLoadingBookings(true);
      try {
        // Get business profile ID for the current user if in dashboard (not external) view
        let userBusinessId: string | null = null;
        
        if (!isExternalCalendar && user?.id) {
          const { data: businessProfile } = await supabase
            .from("business_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
            
          userBusinessId = businessProfile?.id || null;
        }
        
        // For external calendar, use the provided businessId
        // For internal calendar (dashboard), use the user's business ID
        const targetBusinessId = isExternalCalendar ? businessId : userBusinessId;
        
        if (!targetBusinessId && !user?.id) {
          setIsLoadingBookings(false);
          return;
        }
        
        // Fetch all approved booking requests
        const { data, error } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('status', 'approved');
          
        if (error) throw error;
        
        // Filter by business ID
        let filteredData = data;
        
        if (targetBusinessId) {
          // If we have a business ID (either external or user's business), filter by it
          filteredData = data.filter((booking: BookingRequest) => 
            booking.business_id === targetBusinessId
          );
        } else if (user?.id) {
          // Otherwise show the user's personal bookings
          filteredData = data.filter((booking: BookingRequest) => 
            booking.user_id === user.id
          );
        }
        
        // Convert booking requests to calendar events
        const bookingEvents: CalendarEventType[] = (filteredData || []).map((booking: BookingRequest) => ({
          id: booking.id,
          title: booking.title,
          start_date: booking.start_date,
          end_date: booking.end_date,
          type: 'booking_request', // Special type for styling
          user_id: booking.user_id || '',
          created_at: booking.created_at,
          requester_name: booking.requester_name, // Include additional booking info
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
    
    // Set up interval to refresh approved bookings
    const intervalId = setInterval(fetchApprovedBookings, 15000);
    return () => clearInterval(intervalId);
  }, [user?.id, isExternalCalendar, businessId]);
  
  // Combine regular events and approved bookings
  const combinedEvents = [...(events || []), ...approvedBookings];
  // If showing all events in external view, also include regular events from the business owner
  const allEvents = showAllEvents && isExternalCalendar 
    ? [...combinedEvents, ...regularEvents] 
    : combinedEvents;

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

  // Only check authentication for non-external calendars
  if (!isExternalCalendar && !user) {
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
    if (isExternalCalendar) return; // Don't allow creating events on external calendar
    
    const clickedDate = new Date(date);
    clickedDate.setHours(hour || 9, 0, 0, 0);
    
    // First set the date
    setDialogSelectedDate(clickedDate);
    // Then open the dialog
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleAddEventClick = () => {
    if (isExternalCalendar) return; // Don't allow creating events on external calendar
    
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    // First set the date
    setDialogSelectedDate(now);
    // Then open the dialog
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleEventClick = (event: CalendarEventType) => {
    // Only allow editing regular events, not booking requests
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
        onViewChange={setView}
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
            key={dialogSelectedDate?.getTime()} // Force re-render when date changes
            open={isNewEventDialogOpen}
            onOpenChange={setIsNewEventDialogOpen}
            selectedDate={dialogSelectedDate}
            onSubmit={handleCreateEvent}
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
            />
          )}
        </>
      )}
    </div>
  );
};
