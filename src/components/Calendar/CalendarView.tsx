
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { format } from "date-fns";
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

export const CalendarView = ({ 
  days, 
  events, 
  selectedDate, 
  view, 
  onDayClick, 
  onEventClick,
  isExternalCalendar = false 
}: CalendarViewProps) => {
  const { t } = useLanguage();
  const [normalizedEvents, setNormalizedEvents] = useState<CalendarEventType[]>(events);
  
  // Validate days array
  const validDays = Array.isArray(days) ? 
    days.filter(day => day instanceof Date && !isNaN(day.getTime())) : 
    [new Date()];
  
  // When events change, update normalized events
  useEffect(() => {
    // Filter out events with invalid dates
    const validEvents = events.filter(event => {
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      return !isNaN(startDate.getTime()) && !isNaN(endDate.getTime());
    });
    
    if (validEvents.length !== events.length) {
      console.warn(`Filtered out ${events.length - validEvents.length} events with invalid dates`);
    }
    
    setNormalizedEvents(validEvents);
  }, [events]);

  // Ensure we have a valid selected date
  const validSelectedDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) ? 
    selectedDate : new Date();
  
  const formattedSelectedDate = format(validSelectedDate, "yyyy-MM-dd");

  return (
    <div className="h-full">
      <CalendarGrid
        days={validDays}
        events={normalizedEvents}
        formattedSelectedDate={formattedSelectedDate}
        view={view}
        onDayClick={onDayClick}
        onEventClick={onEventClick}
        isExternalCalendar={isExternalCalendar}
      />
    </div>
  );
};
