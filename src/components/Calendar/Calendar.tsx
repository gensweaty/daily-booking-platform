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

interface DialogInstance {
  key: string;
  event: CalendarEventType | null;
  date: Date | null;
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
  const [dialogs, setDialogs] = useState<DialogInstance[]>([]);
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
      view,
      dialogsCount: dialogs.length
    });
    
    if (events?.length > 0) {
      console.log("[Calendar] First event:", events[0]);
      console.log("[Calendar] All events:", events);
    }
  }, [isExternalCalendar, businessId, businessUserId, allowBookingRequests, events, view, directEvents, fetchedEvents, dialogs]);

  const {
    handleCreateEvent: baseHandleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent: async (data) => {
      console.log("🔄 Calendar creating event:", data);
      const result = await createEvent?.(data);
      console.log("✅ Event created successfully:", result);

      // For group events, add a new dialog to the queue for editing
      if (result && data.is_group_event) {
        console.log("🎯 New group event created, adding edit dialog to queue:", result);
        setDialogs((prev) => [
          ...prev,
          {
            key: `group-edit-${result.id}-${Date.now()}`,
            event: result,
            date: new Date(result.start_date),
          },
        ]);
      }

      return result;
    },
    updateEvent: async (data) => {
      const result = await updateEvent?.(data);
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
      console.log("📅 Creating new event for date:", clickedDate);
      setDialogs((prev) => [
        ...prev,
        {
          key: `new-${Date.now()}`,
          event: null,
          date: clickedDate,
        },
      ]);
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
      
      console.log("➕ Adding new event dialog to queue");
      setDialogs((prev) => [
        ...prev,
        {
          key: `new-${Date.now()}`,
          event: null,
          date: now,
        },
      ]);
    }
  };

  const handleEventClick = (event: CalendarEventType) => {
    if (!isExternalCalendar) {
      console.log("📝 Adding edit event dialog to queue:", { id: event.id, is_group_event: event.is_group_event });
      setDialogs((prev) => [
        ...prev,
        {
          key: `edit-${event.id}-${Date.now()}`,
          event: event,
          date: new Date(event.start_date),
        },
      ]);
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

  const handleDialogClose = (dialogKey: string) => {
    console.log("🔄 Removing dialog from queue:", dialogKey);
    setDialogs((prev) => prev.filter((d) => d.key !== dialogKey));
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
          {/* Dialog Queue: Each dialog gets a fresh instance */}
          {dialogs.map(({ key, event, date }) => (
            <EventDialog
              key={key}
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  handleDialogClose(key);
                }
              }}
              selectedDate={date}
              event={event}
              onSubmit={event ? handleUpdateEvent : baseHandleCreateEvent}
              onDelete={event ? handleDeleteEvent : undefined}
            />
          ))}
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
