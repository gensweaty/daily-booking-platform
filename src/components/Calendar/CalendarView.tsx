
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
    // Initialize with resolvedTheme first, fallback to theme, then check document class
    resolvedTheme || theme || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  );
  
  // Listen for theme changes
  useEffect(() => {
    // Update state when theme changes from context
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
    
    // Initial theme check from HTML class
    const checkInitialTheme = () => {
      if (typeof document !== 'undefined') {
        if (document.documentElement.classList.contains('dark')) {
          setCurrentTheme('dark');
        }
      }
    };
    
    // Check on mount
    checkInitialTheme();
    
    // Add event listeners
    document.addEventListener('themeChanged', handleThemeChange as EventListener);
    document.addEventListener('themeInit', handleThemeInit as EventListener);
    
    return () => {
      // Remove event listeners
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
  
  // Strictly filter events to make sure deleted events don't show up
  const filteredEvents = events.filter(event => {
    // First check if deleted_at is undefined or null
    if (event.deleted_at === undefined || event.deleted_at === null) {
      return true; // Keep events that don't have deleted_at field or it's null
    }
    
    // If deleted_at has a value (a timestamp), filter out this deleted event
    return false;
  });
  
  // Add debug log for events in CalendarView
  useEffect(() => {
    if (isExternalCalendar) {
      console.log(`[CalendarView] Rendering external calendar with ${events.length} events, ${filteredEvents.length} after filtering deleted`);
      if (events.length > filteredEvents.length) {
        console.log("[CalendarView] Filtered out deleted events:", events.filter(e => e.deleted_at));
      }
      if (filteredEvents.length > 0) {
        console.log("[CalendarView] First event sample:", filteredEvents[0]);
      }
    }
    // Debug theme state
    console.log("[CalendarView] Current theme state:", { 
      theme, 
      resolvedTheme, 
      currentTheme,
      isDarkClass: typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    });
  }, [events, filteredEvents, isExternalCalendar, theme, resolvedTheme, currentTheme]);

  const formattedSelectedDate = formatDate(selectedDate, "yyyy-MM-dd");

  return (
    <div className="h-full">
      <CalendarGrid
        days={daysToRender}
        events={filteredEvents} // Use the filtered events
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
