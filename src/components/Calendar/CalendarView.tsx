
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { formatDate, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
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
  
  // Filter events to make sure deleted events don't show up
  const filteredEvents = events.filter(event => {
    if (event.deleted_at === undefined || event.deleted_at === null) {
      return true;
    }
    return false;
  });
  
  useEffect(() => {
    console.log(`[CalendarView] Rendering calendar with ${events.length} total events, ${filteredEvents.length} after filtering deleted`);
    
    const parentEvents = filteredEvents.filter(e => !e.parent_event_id);
    const childEvents = filteredEvents.filter(e => !!e.parent_event_id);
    console.log(`[CalendarView] Parent events: ${parentEvents.length}, Child events (recurring instances): ${childEvents.length}`);
    
    if (events.length > filteredEvents.length) {
      console.log("[CalendarView] Filtered out deleted events:", events.filter(e => e.deleted_at));
    }
    if (filteredEvents.length > 0) {
      console.log("[CalendarView] Sample events to display:", filteredEvents.slice(0, 3));
    }
    
    if (isExternalCalendar) {
      console.log(`[CalendarView] External calendar mode with ${filteredEvents.length} events`);
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
      console.log(`[CalendarView] Event "${event.title}" on ${eventDate.toDateString()} - Parent ID: ${event.parent_event_id || 'none'}`);
    });
  }, [events, filteredEvents, isExternalCalendar, theme, resolvedTheme, currentTheme]);

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
