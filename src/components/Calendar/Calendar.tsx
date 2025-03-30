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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BookingRequestForm } from "../business/BookingRequestForm";
import { useToast } from "@/components/ui/use-toast";

interface CalendarProps {
  defaultView?: CalendarViewType;
  currentView?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
  isExternalCalendar?: boolean;
  businessId?: string;
  businessUserId?: string | null;
  showAllEvents?: boolean;
  allowBookingRequests?: boolean;
}

export const Calendar = ({ 
  defaultView = "week", 
  currentView,
  onViewChange,
  isExternalCalendar = false,
  businessId,
  businessUserId,
  showAllEvents = false,
  allowBookingRequests = false
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents(
    isExternalCalendar && businessId ? businessId : undefined,
    isExternalCalendar && businessUserId ? businessUserId : undefined
  );
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [bookingStartTime, setBookingStartTime] = useState("09:00");
  const [bookingDate, setBookingDate] = useState<Date | undefined>(undefined);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (currentView) {
      setView(currentView);
    }
  }, [currentView]);

  useEffect(() => {
    console.log("Calendar props:", { 
      isExternalCalendar, 
      businessId,
      businessUserId, 
      allowBookingRequests,
      eventsCount: events?.length || 0,
      view,
      events
    });
  }, [isExternalCalendar, businessId, businessUserId, allowBookingRequests, events, view]);

  useEffect(() => {
    const invalidateQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
    };
    
    invalidateQueries();
    const intervalId = setInterval(invalidateQueries, 3000);
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
    const clickedDate = new Date(date);
    clickedDate.setHours(hour || 9, 0, 0, 0);
    
    if (isExternalCalendar && allowBookingRequests) {
      setBookingDate(clickedDate);
      const formattedHour = hour?.toString().padStart(2, '0') || '09';
      setBookingStartTime(`${formattedHour}:00`);
      setIsBookingFormOpen(true);
    } else if (!isExternalCalendar) {
      setDialogSelectedDate(clickedDate);
      setTimeout(() => setIsNewEventDialogOpen(true), 0);
    }
  };

  const handleAddEventClick = () => {
    if (isExternalCalendar && allowBookingRequests) {
      const now = new Date();
      setBookingDate(now);
      setIsBookingFormOpen(true);
    } else if (!isExternalCalendar) {
      const now = new Date();
      now.setHours(9, 0, 0, 0);
      
      setDialogSelectedDate(now);
      setTimeout(() => setIsNewEventDialogOpen(true), 0);
    }
  };

  const handleEventClick = (event: CalendarEventType) => {
    if (!isExternalCalendar) {
      setSelectedEvent(event);
    } else if (isExternalCalendar && allowBookingRequests) {
      toast({
        title: "Time slot not available",
        description: "This time slot is already booked. Please select a different time.",
      });
    }
  };

  const handleBookingSuccess = () => {
    setIsBookingFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ['booking_requests'] });
    
    toast({
      title: "Booking request submitted",
      description: "Your booking request has been submitted and is pending approval."
    });
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

  return (
    <div className="h-full flex flex-col gap-4">
      <CalendarHeader
        selectedDate={selectedDate}
        view={view}
        onViewChange={handleViewChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={(isExternalCalendar && allowBookingRequests) || !isExternalCalendar ? handleAddEventClick : undefined}
        isExternalCalendar={isExternalCalendar}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={getDaysForView()}
            events={events}
            selectedDate={selectedDate}
            view={view}
            onDayClick={(isExternalCalendar && allowBookingRequests) || !isExternalCalendar ? handleCalendarDayClick : undefined}
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

      {isExternalCalendar && allowBookingRequests && (
        <Dialog open={isBookingFormOpen} onOpenChange={setIsBookingFormOpen}>
          <DialogContent className="max-w-md">
            {bookingDate && businessId && (
              <BookingRequestForm
                businessId={businessId}
                selectedDate={bookingDate}
                startTime={bookingStartTime}
                endTime={`${parseInt(bookingStartTime.split(':')[0]) + 1}:00`}
                onSuccess={handleBookingSuccess}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
