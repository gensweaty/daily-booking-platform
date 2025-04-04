
import React, { useState, useEffect } from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { EventDialog } from "./EventDialog";
import { format, addDays, startOfWeek, startOfMonth, addMonths, addWeeks } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

interface CalendarProps {
  isExternalCalendar?: boolean;
  businessId?: string;
  businessUserId?: string;
  allowBookingRequests?: boolean;
  directEvents?: CalendarEventType[];
  fetchedEvents?: CalendarEventType[];
  onEventCreate?: (event: Partial<CalendarEventType>) => Promise<CalendarEventType | void>;
  onEventUpdate?: (id: string, event: Partial<CalendarEventType>) => Promise<CalendarEventType | void>;
  onEventDelete?: (id: string) => Promise<void>;
  view?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
  defaultView?: CalendarViewType;
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
  view: externalView,
  onViewChange: externalViewChange,
  defaultView = "month",
}) => {
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [localView, setLocalView] = useState<CalendarViewType>(externalView || defaultView);
  const [days, setDays] = useState<Date[]>([]);
  const { toast } = useToast();
  
  // Use the external view state if provided, otherwise use local state
  const currentView = externalView || localView;
  
  // Handle view changes internally if no external handler is provided
  const handleViewChange = (newView: CalendarViewType) => {
    if (externalViewChange) {
      externalViewChange(newView);
    } else {
      setLocalView(newView);
    }
  };

  // Calculate days to display based on view and selected date
  useEffect(() => {
    try {
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
      
      // Validate the days array to ensure all dates are valid
      const validDays = newDays.filter(day => 
        day instanceof Date && !isNaN(day.getTime())
      );
      
      if (validDays.length !== newDays.length) {
        console.warn("Some days were invalid and filtered out", newDays);
      }
      
      setDays(validDays);
    } catch (error) {
      console.error("Error calculating days:", error);
      setDays([new Date()]); // Fallback to today if there's an error
    }
  }, [selectedDate, localView, externalView]);
  
  useEffect(() => {
    // Combine direct events and fetched events and filter out invalid ones
    try {
      const combinedEvents = [...(directEvents || []), ...(fetchedEvents || [])];
      
      // Filter out events with invalid dates
      const validEvents = combinedEvents.filter(event => {
        try {
          const startDate = new Date(event.start_date);
          const endDate = new Date(event.end_date);
          return (
            startDate instanceof Date && !isNaN(startDate.getTime()) &&
            endDate instanceof Date && !isNaN(endDate.getTime())
          );
        } catch (e) {
          console.warn("Invalid event date:", event, e);
          return false;
        }
      });
      
      if (validEvents.length !== combinedEvents.length) {
        console.warn(`Filtered out ${combinedEvents.length - validEvents.length} events with invalid dates`);
      }
      
      setEvents(validEvents);
    } catch (error) {
      console.error("Error processing events:", error);
      setEvents([]);
    }
  }, [directEvents, fetchedEvents]);

  // Navigation functions
  const handlePrevious = () => {
    try {
      if (currentView === 'month') {
        setSelectedDate(prev => addMonths(prev, -1));
      } else if (currentView === 'week') {
        setSelectedDate(prev => addWeeks(prev, -1));
      } else {
        setSelectedDate(prev => addDays(prev, -1));
      }
    } catch (error) {
      console.error("Error navigating to previous period:", error);
      toast({
        title: "Navigation Error",
        description: "There was an error navigating to the previous period.",
        variant: "destructive",
      });
    }
  };

  const handleNext = () => {
    try {
      if (currentView === 'month') {
        setSelectedDate(prev => addMonths(prev, 1));
      } else if (currentView === 'week') {
        setSelectedDate(prev => addWeeks(prev, 1));
      } else {
        setSelectedDate(prev => addDays(prev, 1));
      }
    } catch (error) {
      console.error("Error navigating to next period:", error);
      toast({
        title: "Navigation Error",
        description: "There was an error navigating to the next period.",
        variant: "destructive",
      });
    }
  };

  // Event handling functions
  const handleEventClick = (event: CalendarEventType) => {
    setSelectedEvent(event);
  };

  const handleDayClick = (date: Date, hour?: number) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.error("Invalid date clicked:", date);
      return;
    }
    
    try {
      const newDate = new Date(date);
      
      // If an hour is specified (for week/day view), set it
      if (typeof hour === 'number') {
        newDate.setHours(hour, 0, 0, 0);
      } else {
        // For month view, default to noon
        newDate.setHours(12, 0, 0, 0);
      }
      
      setSelectedDate(newDate);
      setIsNewEventDialogOpen(true);
    } catch (error) {
      console.error("Error handling day click:", error);
      toast({
        title: "Error",
        description: "There was an error selecting this date.",
        variant: "destructive",
      });
    }
  };

  // Handle event creation with proper type safety
  const handleEventCreate = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!onEventCreate) {
      throw new Error("No event creation handler provided");
    }
    
    try {
      const result = await onEventCreate(data);
      if (!result) {
        throw new Error("Failed to create event");
      }
      setIsNewEventDialogOpen(false);
      return result as CalendarEventType;
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  };

  // Handle event updates with proper type safety
  const handleEventUpdate = async (id: string, data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!onEventUpdate) {
      throw new Error("No event update handler provided");
    }
    
    try {
      const result = await onEventUpdate(id, data);
      if (!result) {
        throw new Error("Failed to update event");
      }
      setSelectedEvent(null);
      return result as CalendarEventType;
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
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
    view: currentView
  });

  // Safe formatting for selected date
  let formattedSelectedDate = "";
  try {
    if (selectedDate instanceof Date && !isNaN(selectedDate.getTime())) {
      formattedSelectedDate = format(selectedDate, "yyyy-MM-dd");
    } else {
      formattedSelectedDate = format(new Date(), "yyyy-MM-dd");
    }
  } catch (error) {
    console.error("Error formatting selected date:", error);
    formattedSelectedDate = format(new Date(), "yyyy-MM-dd");
  }

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
      
      <CalendarView
        days={days}
        events={events}
        selectedDate={selectedDate}
        view={currentView}
        onDayClick={handleDayClick}
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
            return await handleEventUpdate(selectedEvent.id, data);
          } else {
            return await handleEventCreate(data);
          }
        }}
        onDelete={selectedEvent && onEventDelete ? () => onEventDelete(selectedEvent.id) : undefined}
        event={selectedEvent}
        isBookingRequest={isExternalCalendar && allowBookingRequests}
      />
    </div>
  );
};
