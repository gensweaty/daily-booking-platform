
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { formatDate, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  selectedDate: Date;
  view: CalendarViewType;
  onDayClick?: (date: Date, hour?: number) => void;
  onEventClick?: (event: CalendarEventType) => void;
  isExternalCalendar?: boolean;
}

export function CalendarView({
  days,
  events,
  selectedDate,
  view,
  onDayClick,
  onEventClick,
  isExternalCalendar = false,
}: CalendarViewProps) {
  const { t } = useLanguage();
  const { theme, resolvedTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<string | undefined>(
    resolvedTheme || theme || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  );
  
  // Listen for theme changes
  useEffect(() => {
    const newTheme = resolvedTheme || theme;
    if (newTheme) {
      setCurrentTheme(newTheme);
    }
    
    const handleThemeChange = (event: CustomEvent) => {
      setCurrentTheme(event.detail.theme);
    };
    
    const handleThemeInit = (event: CustomEvent) => {
      setCurrentTheme(event.detail.theme);
    };
    
    const checkInitialTheme = () => {
      if (typeof document !== 'undefined') {
        if (document.documentElement.classList.contains('dark')) {
          setCurrentTheme('dark');
        }
      }
    };
    
    checkInitialTheme();
    
    document.addEventListener('themeChanged', handleThemeChange as EventListener);
    document.addEventListener('themeInit', handleThemeInit as EventListener);
    
    return () => {
      document.removeEventListener('themeChanged', handleThemeChange as EventListener);
      document.removeEventListener('themeInit', handleThemeInit as EventListener);
    };
  }, [theme, resolvedTheme]);
  
  // For month view, ensure we have days from both previous and next months to fill the grid
  const getDaysWithSurroundingMonths = () => {
    if (view === 'month') {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);
      
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
    
    return days;
  };
  
  const daysToRender = view === 'month' ? getDaysWithSurroundingMonths() : days;
  
  // CRITICAL FIX: Filter events based on the current view's date range
  // This matches how the debugger works - it filters events for the current view
  const getEventsForCurrentView = () => {
    if (!events || events.length === 0) return [];
    
    // Calculate the date range for the current view
    let viewStart: Date;
    let viewEnd: Date;
    
    if (view === 'month') {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      viewStart = startOfWeek(monthStart);
      viewEnd = endOfWeek(monthEnd);
    } else if (view === 'week') {
      viewStart = startOfWeek(selectedDate);
      viewEnd = endOfWeek(selectedDate);
    } else { // day view
      viewStart = new Date(selectedDate);
      viewStart.setHours(0, 0, 0, 0);
      viewEnd = new Date(selectedDate);
      viewEnd.setHours(23, 59, 59, 999);
    }
    
    // First filter out deleted events
    const nonDeletedEvents = events.filter(event => {
      if (event.deleted_at === undefined || event.deleted_at === null) {
        return true;
      }
      return false;
    });
    
    // Then filter events that fall within the current view's date range
    const eventsInView = nonDeletedEvents.filter(event => {
      const eventDate = new Date(event.start_date);
      const isInRange = isWithinInterval(eventDate, { start: viewStart, end: viewEnd });
      
      if (isInRange) {
        console.log(`[CalendarView] Event "${event.title}" (${event.start_date}) is in view range`);
      }
      
      return isInRange;
    });
    
    console.log(`[CalendarView] View range: ${viewStart.toISOString()} to ${viewEnd.toISOString()}`);
    console.log(`[CalendarView] Filtered events for view: ${eventsInView.length}/${events.length}`);
    
    return eventsInView;
  };
  
  const filteredEvents = getEventsForCurrentView();
  
  useEffect(() => {
    console.log(`[CalendarView] Rendering calendar with ${events.length} total events, ${filteredEvents.length} after filtering`);
    
    if (events.length > 0) {
      const parentEvents = events.filter(e => !e.parent_event_id);
      const childEvents = events.filter(e => !!e.parent_event_id);
      console.log(`[CalendarView] All events - Parent: ${parentEvents.length}, Child (recurring instances): ${childEvents.length}`);
    }
    
    if (filteredEvents.length > 0) {
      const parentInView = filteredEvents.filter(e => !e.parent_event_id);
      const childInView = filteredEvents.filter(e => !!e.parent_event_id);
      console.log(`[CalendarView] Events in view - Parent: ${parentInView.length}, Child (recurring instances): ${childInView.length}`);
      console.log("[CalendarView] Sample events in view:", filteredEvents.slice(0, 3));
    }
    
    if (isExternalCalendar) {
      console.log(`[CalendarView] External calendar mode with ${filteredEvents.length} events in view`);
    }
    
    console.log("[CalendarView] Current theme state:", { 
      theme, 
      resolvedTheme, 
      currentTheme,
      isDarkClass: typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    });

    // CRITICAL DEBUG: Log each event that will be displayed
    filteredEvents.forEach(event => {
      const eventDate = new Date(event.start_date);
      console.log(`[CalendarView] Displaying event "${event.title}" on ${eventDate.toDateString()} - Parent ID: ${event.parent_event_id || 'none'}`);
    });
  }, [events, filteredEvents, isExternalCalendar, theme, resolvedTheme, currentTheme, view, selectedDate]);

  const formattedSelectedDate = formatDate(selectedDate, "yyyy-MM-dd");

  return (
    <div className="h-full">
      <CalendarGrid
        days={daysToRender}
        events={filteredEvents}
        formattedSelectedDate={formattedSelectedDate}
        view={view}
        onDayClick={onDayClick}
        onEventClick={onEventClick}
        isExternalCalendar={isExternalCalendar}
        theme={currentTheme}
      />
    </div>
  );
};
