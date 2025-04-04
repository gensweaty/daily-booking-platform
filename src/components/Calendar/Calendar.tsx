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
  format,
} from "date-fns";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { ExternalEventDialog } from "./ExternalEventDialog";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
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
  directEvents?: CalendarEventType[];
}

export const Calendar = ({ 
  defaultView = "week", 
  currentView,
  onViewChange,
  isExternalCalendar = false,
  businessId,
  businessUserId,
  showAllEvents = false,
  allowBookingRequests = false,
  directEvents
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  
  // Only use the hook if we're not getting directEvents
  const { events: fetchedEvents, isLoading: isLoadingFromHook, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents(
    !directEvents && (isExternalCalendar && businessId ? businessId : undefined),
    !directEvents && (isExternalCalendar && businessUserId ? businessUserId : undefined)
  );
  
  // Use directEvents if provided, otherwise use fetchedEvents
  const events = directEvents || fetchedEvents;
  const isLoading = !directEvents && isLoadingFromHook;
  
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState<Date | undefined>(undefined);
  const [bookingStartTime, setBookingStartTime] = useState<string>("");
  const [bookingEndTime, setBookingEndTime] = useState<string>("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Update view when currentView prop changes
  useEffect(() => {
    if (currentView) {
      setView(currentView);
    }
  }, [currentView]);

  // Diagnostic logging
  useEffect(() => {
    console.log("[Calendar] Rendering with props:", { 
      isExternalCalendar, 
      businessId,
      businessUserId, 
      allowBookingRequests,
      directEvents: directEvents?.length || 0,
      fetchedEvents: fetchedEvents?.length || 0,
      eventsCount: events?.length || 0,
      view
    });
    
    if (events?.length > 0) {
      console.log("[Calendar] First event:", events[0]);
    }
  }, [isExternalCalendar, businessId, businessUserId, allowBookingRequests, events, view, directEvents, fetchedEvents]);

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
      const result = await createEvent?.(data);
      return result;
    },
    updateEvent: async (data) => {
      if (!selectedEvent) throw new Error("No event selected");
      const result = await updateEvent?.({
        id: selectedEvent.id,
        updates: data,
      });
      return result;
    },
    deleteEvent: async (id) => {
      await deleteEvent?.(id);
    }
  });

  // Redirect to signin if not authenticated and not on public business page
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
    console.log("[Calendar] Day clicked:", date, "hour:", hour);
    
    const clickedDate = new Date(date);
    if (hour !== undefined) {
      clickedDate.setHours(hour, 0, 0, 0);
    }
    
    if (isExternalCalendar && allowBookingRequests) {
      console.log("[Calendar] Opening external event dialog for date:", clickedDate);
      setBookingDate(clickedDate);
      setIsEventDialogOpen(true);
    } else if (!isExternalCalendar) {
      setDialogSelectedDate(clickedDate);
      setTimeout(() => setIsNewEventDialogOpen(true), 0);
    }
  };

  const handleAddEventClick = () => {
    if (isExternalCalendar && allowBookingRequests) {
      const now = new Date();
      now.setHours(now.getHours(), 0, 0, 0); // Round to current hour
      console.log("[Calendar] Opening external event dialog for current time:", now);
      setBookingDate(now);
      setIsEventDialogOpen(true);
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
    setIsEventDialogOpen(false);
    setIsBookingFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ['booking_requests'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });
    
    toast({
      title: "Booking request submitted",
      description: "Your booking request has been submitted and is pending approval."
    });
  };

  if (error && !directEvents) {
    console.error("Calendar error:", error);
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if (isLoading && !directEvents) {
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
            events={events || []}
            selectedDate={selectedDate}
            view={view}
            onDayClick={handleCalendarDayClick}
            onEventClick={handleEventClick}
            isExternalCalendar={isExternalCalendar}
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

      {isExternalCalendar && allowBookingRequests && businessId && (
        <>
          {/* Legacy booking form - keeping for backup */}
          <Dialog open={isBookingFormOpen} onOpenChange={setIsBookingFormOpen}>
            <DialogContent className="max-w-md">
              {bookingDate && (
                <BookingRequestForm
                  open={isBookingFormOpen}
                  onOpenChange={setIsBookingFormOpen}
                  businessId={businessId}
                  selectedDate={bookingDate}
                  startTime={bookingStartTime}
                  endTime={bookingEndTime}
                  onSuccess={handleBookingSuccess}
                />
              )}
            </DialogContent>
          </Dialog>
          
          {/* New event dialog for external bookings */}
          {bookingDate && (
            <ExternalEventDialog
              open={isEventDialogOpen}
              onOpenChange={setIsEventDialogOpen}
              selectedDate={bookingDate}
              businessId={businessId}
              onSuccess={handleBookingSuccess}
            />
          )}
        </>
      )}
    </div>
  );
};
