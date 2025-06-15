
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
  
  // Filter out deleted events
  const filteredEvents = events.filter(event => {
    if (event.deleted_at === undefined || event.deleted_at === null) {
      return true;
    }
    return false;
  });
  
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
    console.log("[CalendarView] Current theme state:", { 
      theme, 
      resolvedTheme, 
      currentTheme,
      isDarkClass: typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    });
  }, [events, filteredEvents, isExternalCalendar, theme, resolvedTheme, currentTheme]);

  const getDaysInMonth = (date: Date) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  return (
    <div className="h-full">
      <CalendarGrid
        currentDate={selectedDate}
        events={filteredEvents}
        onDateClick={onDayClick || (() => {})}
        onEventClick={onEventClick || (() => {})}
        getDaysInMonth={getDaysInMonth}
      />
    </div>
  );
};
