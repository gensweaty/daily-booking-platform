
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
  
  // When events change, update normalized events
  useEffect(() => {
    setNormalizedEvents(events);
  }, [events]);

  const formattedSelectedDate = formatDate(selectedDate, "yyyy-MM-dd");

  return (
    <div className="h-full">
      <CalendarGrid
        days={days}
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
