import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { CalendarHeader } from "@/components/Calendar/CalendarHeader";
import { CalendarView } from "@/components/Calendar/CalendarView";
import { EventDialog } from "@/components/Calendar/EventDialog";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "next-themes";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  format, 
  addMonths, 
  subMonths, 
  addWeeks, 
  subWeeks,
  startOfDay,
  endOfDay 
} from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeIndicator } from "@/components/Calendar/TimeIndicator";

interface PublicCalendarComponentProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
  events: CalendarEventType[];
}

export const PublicCalendarComponent = ({
  boardUserId,
  externalUserName,  
  externalUserEmail,
  events
}: PublicCalendarComponentProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [dialogSelectedDate, setDialogSelectedDate] = useState<Date | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const getDaysForView = useCallback(() => {
    const today = selectedDate;
    
    switch (view) {
      case 'month':
        const start = startOfWeek(startOfMonth(today));
        const end = endOfWeek(endOfMonth(today));
        const days = [];
        let current = start;
        
        while (current <= end) {
          days.push(current);
          current = addDays(current, 1);
        }
        
        return days;
      case 'week':
        const weekStart = startOfWeek(today);
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
          weekDays.push(addDays(weekStart, i));
        }
        return weekDays;
      case 'day':
        return [today];
      default:
        return [];
    }
  }, [selectedDate, view]);

  const handleViewChange = useCallback((newView: CalendarViewType) => {
    setView(newView);
  }, []);

  const handlePrevious = useCallback(() => {
    setSelectedDate(current => {
      switch (view) {
        case 'month':
          return subMonths(current, 1);
        case 'week':
          return subWeeks(current, 1);
        case 'day':
          return addDays(current, -1);
        default:
          return current;
      }
    });
  }, [view]);

  const handleNext = useCallback(() => {
    setSelectedDate(current => {
      switch (view) {
        case 'month':
          return addMonths(current, 1);
        case 'week':
          return addWeeks(current, 1);
        case 'day':
          return addDays(current, 1);
        default:
          return current;
      }
    });
  }, [view]);

  const handleCalendarDayClick = (clickedDate: Date) => {
    // Set the time for new events to a reasonable default
    const eventDate = new Date(clickedDate);
    eventDate.setHours(9, 0, 0, 0);
    
    setDialogSelectedDate(eventDate);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleAddEventClick = () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    setDialogSelectedDate(now);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleEventClick = (event: CalendarEventType) => {
    // Allow viewing all events but only editing those created by this sub-user
    setSelectedEvent(event);
  };

  // Functions to handle event operations and refresh calendar
  const refreshCalendar = async () => {
    // Wait a bit for database operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
  };

  const handleEventCreated = async () => {
    console.log("Event created by sub-user, refreshing calendar...");
    await refreshCalendar();
  };

  const handleEventUpdated = async () => {
    console.log("Event updated by sub-user, refreshing calendar...");
    await refreshCalendar();
  };

  const handleEventDeleted = async () => {
    console.log("Event deleted by sub-user, refreshing calendar...");
    await refreshCalendar();
  };

  const isDarkTheme = theme === "dark";
  const gridBgClass = isDarkTheme ? "bg-gray-900" : "bg-white";
  const textClass = isDarkTheme ? "text-white" : "text-foreground";

  // Check if user can edit/delete event (only if they created it)
  const canEditEvent = useCallback((event: CalendarEventType) => {
    return event.created_by_type === 'sub_user' && event.created_by_name === externalUserName;
  }, [externalUserName]);

  return (
    <div className={`h-full flex flex-col ${isMobile ? 'gap-2 -mx-4' : 'gap-4'}`}>
      <CalendarHeader
        selectedDate={selectedDate}
        view={view}
        onViewChange={handleViewChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={handleAddEventClick}
        isExternalCalendar={false}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className={`flex-1 ${gridBgClass} ${textClass}`}>
          <CalendarView
            days={getDaysForView()}
            events={events || []}
            selectedDate={selectedDate}
            view={view}
            onDayClick={handleCalendarDayClick}
            onEventClick={handleEventClick}
            isExternalCalendar={false}
          />
        </div>
      </div>

      {/* Event creation dialog */}
      <EventDialog
        key={dialogSelectedDate?.getTime()}
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={dialogSelectedDate}
        onEventCreated={handleEventCreated}
      />

      {/* Event editing dialog - shows all events but only allows editing if created by sub-user */}
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
    </div>
  );
};