
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { formatDate } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

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
  
  // Enhanced debug logging for events in CalendarView
  useEffect(() => {
    if (isExternalCalendar) {
      console.log(`[CalendarView] Rendering external calendar with ${events.length} events`);
      if (events.length > 0) {
        console.log("[CalendarView] First event sample:", events[0]);
        console.log("[CalendarView] Events with descriptions:", events.filter(e => e.description || e.event_notes).length);
        console.log("[CalendarView] Events with booking_request_id:", events.filter(e => e.booking_request_id).length);
        
        // Log events grouped by day for easier debugging
        const eventsByDay = events.reduce((acc, event) => {
          const day = new Date(event.start_date).toDateString();
          if (!acc[day]) acc[day] = [];
          acc[day].push(event);
          return acc;
        }, {} as Record<string, CalendarEventType[]>);
        
        console.log("[CalendarView] Events by day:", Object.keys(eventsByDay).map(day => ({
          day,
          count: eventsByDay[day].length
        })));
      }
    }
  }, [events, isExternalCalendar]);

  const formattedSelectedDate = formatDate(selectedDate, "yyyy-MM-dd");

  return (
    <div className="h-full">
      <CalendarGrid
        days={days}
        events={events}
        formattedSelectedDate={formattedSelectedDate}
        view={view}
        onDayClick={onDayClick}
        onEventClick={onEventClick}
        isExternalCalendar={isExternalCalendar}
      />
    </div>
  );
};
