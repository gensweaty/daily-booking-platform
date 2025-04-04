
import React, { useState, useEffect } from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { EventDialog } from "./EventDialog";
import { format, addDays, startOfWeek, startOfMonth, addMonths, addWeeks } from "date-fns";

interface CalendarProps {
  isExternalCalendar?: boolean;
  businessId?: string;
  businessUserId?: string;
  allowBookingRequests?: boolean;
  directEvents?: CalendarEventType[];
  fetchedEvents?: CalendarEventType[];
  onEventCreate?: (event: Partial<CalendarEventType>) => Promise<void>;
  onEventUpdate?: (id: string, event: Partial<CalendarEventType>) => Promise<void>;
  onEventDelete?: (id: string) => Promise<void>;
  view?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  isExternalCalendar = false,
  businessId = "",
  businessUserId = "",
  allowBookingRequests = false,
  directEvents = [],
  fetchedEvents = [],
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  view = "month",
  onViewChange,
}) => {
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [localView, setLocalView] = useState<CalendarViewType>(view);
  const [days, setDays] = useState<Date[]>([]);
  
  // Handle view changes internally if no external handler is provided
  const handleViewChange = (newView: CalendarViewType) => {
    if (onViewChange) {
      onViewChange(newView);
    } else {
      setLocalView(newView);
    }
  };

  // Calculate days to display based on view and selected date
  useEffect(() => {
    const currentView = onViewChange ? view : localView;
    let newDays: Date[] = [];
    
    if (currentView === 'month') {
      // Generate days for month view
      const monthStart = startOfMonth(selectedDate);
      const weekStart = startOfWeek(monthStart);
      for (let i = 0; i < 42; i++) {
        newDays.push(addDays(weekStart, i));
      }
    } else if (currentView === 'week') {
      // Generate days for week view
      const weekStart = startOfWeek(selectedDate);
      for (let i = 0; i < 7; i++) {
        newDays.push(addDays(weekStart, i));
      }
    } else {
      // Day view - just the selected date
      newDays = [selectedDate];
    }
    
    setDays(newDays);
  }, [selectedDate, localView, view, onViewChange]);
  
  useEffect(() => {
    // Combine direct events and fetched events
    const combinedEvents = [...(directEvents || []), ...(fetchedEvents || [])];
    setEvents(combinedEvents);
  }, [directEvents, fetchedEvents]);

  // Navigation functions
  const handlePrevious = () => {
    const currentView = onViewChange ? view : localView;
    if (currentView === 'month') {
      setSelectedDate(prev => addMonths(prev, -1));
    } else if (currentView === 'week') {
      setSelectedDate(prev => addWeeks(prev, -1));
    } else {
      setSelectedDate(prev => addDays(prev, -1));
    }
  };

  const handleNext = () => {
    const currentView = onViewChange ? view : localView;
    if (currentView === 'month') {
      setSelectedDate(prev => addMonths(prev, 1));
    } else if (currentView === 'week') {
      setSelectedDate(prev => addWeeks(prev, 1));
    } else {
      setSelectedDate(prev => addDays(prev, 1));
    }
  };

  // Event handling functions
  const handleEventClick = (event: CalendarEventType) => {
    setSelectedEvent(event);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsNewEventDialogOpen(true);
  };

  // Debug logs for troubleshooting
  console.log("[Calendar] Rendering with props:", { 
    isExternalCalendar, 
    businessId,
    businessUserId, 
    allowBookingRequests,
    directEvents: directEvents?.length || 0,
    fetchedEvents: fetchedEvents?.length || 0,
    eventsCount: events?.length || 0,
    view: onViewChange ? view : localView
  });
  
  if (events?.length > 0) {
    console.log("[Calendar] First event:", events[0]);
  }

  const currentView = onViewChange ? view : localView;

  return (
    <div className="w-full calendar-container">
      <CalendarHeader 
        selectedDate={selectedDate}
        view={currentView}
        onViewChange={handleViewChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={() => setIsNewEventDialogOpen(true)}
        isExternalCalendar={isExternalCalendar}
      />
      <CalendarGrid 
        days={days}
        events={events}
        formattedSelectedDate={format(selectedDate, "yyyy-MM-dd")}
        view={currentView}
        onDayClick={handleDateClick}
        onEventClick={handleEventClick}
        isExternalCalendar={isExternalCalendar}
      />
      <EventDialog 
        open={isNewEventDialogOpen || selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsNewEventDialogOpen(false);
            setSelectedEvent(null);
          }
        }}
        selectedDate={selectedEvent ? new Date(selectedEvent.start_date) : selectedDate}
        onSubmit={async (data) => {
          if (selectedEvent) {
            if (onEventUpdate) {
              return await onEventUpdate(selectedEvent.id, data);
            }
          } else {
            if (onEventCreate) {
              return await onEventCreate(data);
            }
          }
          throw new Error("No event handler provided");
        }}
        onDelete={selectedEvent && onEventDelete ? () => onEventDelete(selectedEvent.id) : undefined}
        event={selectedEvent}
        isBookingRequest={isExternalCalendar && allowBookingRequests}
      />
    </div>
  );
};
