
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { formatDate, format, isSameDay } from "date-fns";
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

  // For week/day view, generate hours for the time grid
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Render month view
  if (view === 'month') {
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
  }

  // Render week or day view
  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-[auto,1fr] gap-4">
        {/* Time column */}
        <div className="pr-2">
          <div className="h-12"></div> {/* Empty header cell */}
          {hours.map((hour) => (
            <div key={hour} className="h-20 flex items-center justify-end pr-2 text-sm text-gray-500">
              {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
            </div>
          ))}
        </div>
        
        {/* Day columns */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {/* Day headers */}
          <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((day) => (
              <div key={day.toString()} className="h-12 border-b flex items-center justify-center font-semibold">
                {format(day, 'EEE d')}
              </div>
            ))}
          </div>
          
          {/* Time slots */}
          {hours.map((hour) => (
            <div key={hour} className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((day) => {
                const timeSlotEvents = events.filter((event) => {
                  const eventDate = new Date(event.start_date);
                  return isSameDay(day, eventDate) && eventDate.getHours() === hour;
                });
                
                return (
                  <div
                    key={`${day.toString()}-${hour}`}
                    className="h-20 border-b border-r relative hover:bg-gray-50 cursor-pointer"
                    onClick={() => onDayClick?.(day, hour)}
                  >
                    {timeSlotEvents.map((event) => {
                      const startTime = new Date(event.start_date);
                      const endTime = new Date(event.end_date);
                      const durationHours = Math.max(1, (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
                      
                      // Set event styles
                      let eventClass = "absolute left-1 right-1 px-2 py-1 rounded-md overflow-hidden flex items-center shadow-sm";
                      
                      // Use green style for all events in external calendar
                      eventClass += " bg-green-500 text-white";
                      
                      return (
                        <div
                          key={event.id}
                          className={eventClass}
                          style={{ height: `${durationHours * 5}rem` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                        >
                          <div className="flex items-center">
                            <span className="w-3 h-3 mr-2 flex-shrink-0">
                              {/* Calendar icon or bullet */}
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                              </svg>
                            </span>
                            <div className="truncate flex-1">
                              <div className="font-medium text-sm">
                                {"Booked"}
                              </div>
                              <div className="text-xs">
                                {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
