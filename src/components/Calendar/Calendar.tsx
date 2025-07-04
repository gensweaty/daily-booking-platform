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
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BookingRequestForm } from "../business/BookingRequestForm";
import { useToast } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTheme } from "next-themes";
import { RecurringEventDebugger } from "../debug/RecurringEventDebugger";

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
  const [showDebugger, setShowDebugger] = useState(false); // Add debug mode
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { theme } = useTheme();
  
  const { events: fetchedEvents, isLoading: isLoadingFromHook, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents(
    !directEvents && (isExternalCalendar && businessId ? businessId : undefined),
    !directEvents && (isExternalCalendar && businessUserId ? businessUserId : undefined)
  );
  
  const events = directEvents || fetchedEvents;
  const isLoading = !directEvents && isLoadingFromHook;
  
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState<Date | undefined>(undefined);
  const [bookingStartTime, setBookingStartTime] = useState<string>("");
  const [bookingEndTime, setBookingEndTime] = useState<string>("");
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
      console.log("[Calendar] All events:", events); // Log all events to debug
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
      console.log("Calendar passing to updateEvent:", { data, id: selectedEvent.id, type: selectedEvent.type });
      
      const result = await updateEvent?.({
        ...data,
        id: selectedEvent.id,
        type: selectedEvent.type  // Make sure to pass the type from the selected event
      });
      return result;
    },
    deleteEvent: deleteEvent
  });

  if (!isExternalCalendar && !user && !window.location.pathname.includes('/business/')) {
    navigate("/signin");
    return null;
  }

  const getDaysForView = () => {
    switch (view) {
      case "month": {
        const monthStart = startOfMonth(selectedDate);
        return eachDayOfInterval({
          start: monthStart,
          end: endOfMonth(selectedDate),
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
    
    clickedDate.setHours(hour !== undefined ? hour : 9, 0, 0, 0);
    
    if (isExternalCalendar && allowBookingRequests) {
      setBookingDate(clickedDate);
      
      const startHour = format(clickedDate, "HH:mm");
      const endDate = new Date(clickedDate);
      endDate.setHours(clickedDate.getHours() + 1);
      const endHour = format(endDate, "HH:mm");
      
      setBookingStartTime(startHour);
      setBookingEndTime(endHour);
      
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
      
      const startHour = format(now, "HH:mm");
      const endDate = new Date(now);
      endDate.setHours(now.getHours() + 1);
      const endHour = format(endDate, "HH:mm");
      
      setBookingStartTime(startHour);
      setBookingEndTime(endHour);
      
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
    
    toast.event.bookingSubmitted();
  };

  // Functions to handle event operations and refresh calendar
  const refreshCalendar = () => {
    const queryKey = businessId ? ['business-events', businessId] : ['events', user?.id];
    queryClient.invalidateQueries({ queryKey });
  };

  const handleEventCreated = () => {
    console.log("Event created, refreshing calendar...");
    refreshCalendar();
  };

  const handleEventUpdated = () => {
    console.log("Event updated, refreshing calendar...");
    refreshCalendar();
  };

  const handleEventDeleted = () => {
    console.log("Event deleted, refreshing calendar...");
    refreshCalendar();
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
  
  const isDarkTheme = theme === "dark";
  const gridBgClass = isDarkTheme ? "bg-gray-900" : "bg-white";
  const textClass = isDarkTheme ? "text-white" : "text-foreground";

  return (
    <div className={`h-full flex flex-col ${isMobile ? 'gap-2 -mx-4' : 'gap-4'}`}>
      {/* Add debug toggle button */}
      {!isExternalCalendar && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowDebugger(!showDebugger)}
            className="text-xs px-2 py-1 bg-gray-200 rounded"
          >
            {showDebugger ? "Hide" : "Show"} Debug
          </button>
        </div>
      )}
      
      {/* Show debugger if enabled */}
      {showDebugger && <RecurringEventDebugger />}
      
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
        <div className={`flex-1 ${gridBgClass} ${textClass}`}>
          <CalendarView
            days={getDaysForView()}
            events={events || []}
            selectedDate={selectedDate}
            view={view}
            onDayClick={(isExternalCalendar && allowBookingRequests) || !isExternalCalendar ? handleCalendarDayClick : undefined}
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
            onEventCreated={handleEventCreated}
          />

          {selectedEvent && (
            <EventDialog
              key={selectedEvent.id}
              open={!!selectedEvent}
              onOpenChange={() => setSelectedEvent(null)}
              selectedDate={new Date(selectedEvent.start_date)}
              initialData={selectedEvent}
              onEventUpdated={handleEventUpdated}
              onEventDeleted={handleEventDeleted}
            />
          )}
        </>
      )}

      {isExternalCalendar && allowBookingRequests && businessId && (
        <Dialog open={isBookingFormOpen} onOpenChange={setIsBookingFormOpen}>
          <DialogContent className="sm:max-w-md">
            {bookingDate && (
              <BookingRequestForm
                businessId={businessId}
                selectedDate={bookingDate}
                startTime={bookingStartTime}
                endTime={bookingEndTime}
                onSuccess={handleBookingSuccess}
                isExternalBooking={true}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
