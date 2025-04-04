
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { format, isValid } from "date-fns";
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
    days.filter(day => day instanceof Date && isValid(day)) : 
    [new Date()];
  
  // When events change, update normalized events
  useEffect(() => {
    try {
      // Filter out events with invalid dates
      const validEvents = events.filter(event => {
        try {
          const startDate = new Date(event.start_date);
          const endDate = new Date(event.end_date);
          return isValid(startDate) && isValid(endDate);
        } catch (e) {
          console.warn("Invalid event date:", event, e);
          return false;
        }
      });
      
      if (validEvents.length !== events.length) {
        console.warn(`Filtered out ${events.length - validEvents.length} events with invalid dates`);
      }
      
      setNormalizedEvents(validEvents);
    } catch (error) {
      console.error("Error normalizing events:", error);
      setNormalizedEvents([]);
    }
  }, [events]);

  // Ensure we have a valid selected date
  let validSelectedDate = selectedDate;
  if (!selectedDate || !isValid(selectedDate)) {
    console.warn("Invalid selected date, using current date instead:", selectedDate);
    validSelectedDate = new Date();
  }
  
  // Safely format the selected date
  let formattedSelectedDate: string;
  try {
    formattedSelectedDate = format(validSelectedDate, "yyyy-MM-dd");
  } catch (error) {
    console.error("Error formatting selected date:", error);
    formattedSelectedDate = format(new Date(), "yyyy-MM-dd");
  }

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
