
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
  
  // Add debug log for events in CalendarView
  useEffect(() => {
    if (isExternalCalendar) {
      console.log(`[CalendarView] Rendering external calendar with ${events.length} events`);
      if (events.length > 0) {
        console.log("[CalendarView] First event sample:", events[0]);
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
