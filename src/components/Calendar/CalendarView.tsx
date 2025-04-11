
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { formatDate } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { TimeIndicator } from "./TimeIndicator";

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    if (isExternalCalendar) {
      console.log(`[CalendarView] Rendering external calendar with ${events.length} events`);
      if (events.length > 0) {
        console.log("[CalendarView] First event sample:", events[0]);
      }
    }
  }, [events, isExternalCalendar]);

  const formattedSelectedDate = formatDate(selectedDate, "yyyy-MM-dd");

  // Debug logging for view changes
  useEffect(() => {
    console.log("[CalendarView] Current view:", view);
  }, [view]);

  return (
    <div className="h-full overflow-hidden">
      {(view === 'week' || view === 'day') && (
        <div className="flex h-full flex-col">
          {/* Mobile header for day/week views */}
          {isMobile && (
            <div className="sticky top-0 bg-white z-10 border-b border-gray-200">
              {view === 'week' && (
                <div className="grid grid-cols-7 text-center py-2">
                  {days.map((day) => (
                    <div key={day.toISOString()} className="flex flex-col items-center">
                      <div className="text-sm font-medium">{formatDate(day, 'EEE')}</div>
                      <div className="text-xs text-gray-500">{formatDate(day, 'MMM d')}</div>
                    </div>
                  ))}
                </div>
              )}
              {view === 'day' && (
                <div className="text-center py-3">
                  <div className="text-base font-medium">{formatDate(selectedDate, 'EEE')}</div>
                  <div className="text-sm text-gray-500">{formatDate(selectedDate, 'MMM d')}</div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex flex-1 overflow-hidden">
            {/* Time indicator with fixed positioning */}
            <TimeIndicator />
            
            <div className="flex-1 overflow-auto">
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
          </div>
        </div>
      )}
      
      {view === 'month' && (
        <CalendarGrid
          days={days}
          events={events}
          formattedSelectedDate={formattedSelectedDate}
          view={view}
          onDayClick={onDayClick}
          onEventClick={onEventClick}
          isExternalCalendar={isExternalCalendar}
        />
      )}
    </div>
  );
};
