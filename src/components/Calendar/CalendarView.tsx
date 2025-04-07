
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
  
  // Improved debug logging for events
  useEffect(() => {
    console.log(`[CalendarView] Rendering calendar with ${events.length} events (external: ${isExternalCalendar})`);
    
    // Analyze deleted_at field values
    if (events.length > 0) {
      const deletedAtValues = events.map(e => e.deleted_at);
      const deletedCount = deletedAtValues.filter(val => val !== null).length;
      const nullCount = deletedAtValues.filter(val => val === null).length;
      const undefinedCount = deletedAtValues.filter(val => val === undefined).length;
      
      console.log("[CalendarView] Events deleted_at analysis:", {
        total: events.length,
        deleted: deletedCount,
        null: nullCount,
        undefined: undefinedCount
      });
      
      if (events.length > 0) {
        console.log("[CalendarView] First few events:", events.slice(0, 3).map(e => ({
          id: e.id,
          title: e.title,
          start: e.start_date,
          end: e.end_date,
          type: e.type,
          deleted_at: e.deleted_at
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
