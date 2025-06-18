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
      
      // FIXED: After creating a new event, pass it back to the dialog for proper initialization
      if (result && data.is_group_event) {
        console.log("New group event created, reopening with saved event:", result);
        setSelectedEvent(result);
        setTimeout(() => {
          setIsNewEventDialogOpen(false);
          // Small delay to ensure state is updated, then reopen with the created event
          setTimeout(() => setIsNewEventDialogOpen(true), 100);
        }, 200);
      }
      
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
    deleteEvent: async (id) => {
      await deleteEvent?.(id);
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
      // FIXED: Clear selected event when creating new event
      setSelectedEvent(null);
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
      
      // FIXED: Clear selected event when creating new event
      setSelectedEvent(null);
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

  // FIXED: Custom handler to avoid immediate dialog close for new group events
  const handleNewEventDialogOpenChange = (open: boolean) => {
    if (!open) {
      // Clear selected event when closing new event dialog
      setSelectedEvent(null);
    }
    setIsNewEventDialogOpen(open);
  };

  // FIXED: Custom handler for editing events
  const handleEditEventDialogOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedEvent(null);
    }
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
          {/* FIXED: New event dialog - handle both new events and reopened group events */}
          <EventDialog
            key={selectedEvent ? `edit-${selectedEvent.id}` : `new-${dialogSelectedDate?.getTime()}`}
            open={isNewEventDialogOpen}
            onOpenChange={handleNewEventDialogOpenChange}
            selectedDate={dialogSelectedDate}
            event={selectedEvent} // FIXED: Pass the selected event if it exists (for reopened group events)
            onSubmit={handleCreateEvent}
          />

          {/* FIXED: Edit event dialog - only show when we have a selected event and not creating new */}
          {selectedEvent && !isNewEventDialogOpen && (
            <EventDialog
              key={`edit-existing-${selectedEvent.id}`}
              open={!!selectedEvent}
              onOpenChange={handleEditEventDialogOpenChange}
              selectedDate={new Date(selectedEvent.start_date)}
              event={selectedEvent}
              onSubmit={handleUpdateEvent}
              onDelete={handleDeleteEvent}
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
