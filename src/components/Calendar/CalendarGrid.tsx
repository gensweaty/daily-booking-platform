
import { format, isSameDay, isSameMonth, startOfWeek, addDays } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface CalendarGridProps {
  days: Date[];
  events: CalendarEventType[];
  formattedSelectedDate: string;
  view: string;
  onDayClick?: (date: Date, hour?: number) => void;
  onEventClick?: (event: CalendarEventType) => void;
  isExternalCalendar?: boolean;
}

export const CalendarGrid = ({
  days,
  events,
  formattedSelectedDate,
  view,
  onDayClick,
  onEventClick,
  isExternalCalendar = false,
}: CalendarGridProps) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Add responsive check for mobile devices
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Get the start of the week for proper alignment
  const startDate = startOfWeek(days[0]);
  
  // Generate properly aligned weekday headers
  const weekDays = Array.from({ length: 7 }, (_, i) => 
    format(addDays(startDate, i), 'EEE')
  );

  // Convert formattedSelectedDate string back to a Date for comparison
  const selectedDate = new Date(formattedSelectedDate);

  // Get event color based on type and whether it's an external calendar
  const getEventStyles = (event: CalendarEventType) => {
    if (isExternalCalendar) {
      // In external calendar, all events should have a consistent appearance as "Booked"
      return "bg-green-500 text-white";
    } else {
      // In internal calendar, use event type to determine appearance
      if (event.type === "booking_request") {
        return "bg-green-500 text-white"; 
      } else if (event.type === "birthday") {
        return "bg-blue-100 text-blue-700";
      } else {
        return "bg-purple-100 text-purple-700";
      }
    }
  };

  // Get event title based on whether it's an external calendar
  const getEventTitle = (event: CalendarEventType): string => {
    // For external calendar, always display as "Booked"
    if (isExternalCalendar) {
      return "Booked";
    }
    // For internal calendar, display the actual title
    return event.title;
  };

  // For week and day view, we need to render hours
  if (view === 'week' || view === 'day') {
    // Reorder hours to start from 6 AM
    const HOURS = [
      ...Array.from({ length: 18 }, (_, i) => i + 6), // 6 AM to 23 PM
      ...Array.from({ length: 6 }, (_, i) => i) // 0 AM to 5 AM
    ];
    
    return (
      <div className={`grid flex-1 overflow-y-auto ${isMobile ? "w-full" : ""}`}>
        <div className="grid" style={{ 
          gridTemplateRows: `repeat(${HOURS.length}, ${isMobile ? "5rem" : "6rem"})`,
          height: `${HOURS.length * (isMobile ? 5 : 6)}rem`
        }}>
          {HOURS.map((hourIndex) => (
            <div 
              key={hourIndex} 
              className={`grid border-b border-gray-200`}
              style={{ 
                gridTemplateColumns: view === 'day' ? '1fr' : 'repeat(7, 1fr)',
                height: isMobile ? '5rem' : '6rem'
              }}
            >
              {days.map((day) => (
                <div
                  key={`${day.toISOString()}-${hourIndex}`}
                  className={`border-r border-gray-200 p-1 relative ${
                    !isSameMonth(day, selectedDate) ? "text-gray-400" : ""
                  }`}
                  onClick={() => onDayClick?.(day, hourIndex)}
                >
                  {/* Render events that start in this hour */}
                  {events
                    .filter((event) => {
                      const eventDate = new Date(event.start_date);
                      return (
                        isSameDay(eventDate, day) && 
                        eventDate.getHours() === hourIndex
                      );
                    })
                    .map((event) => {
                      const startTime = new Date(event.start_date);
                      const endTime = new Date(event.end_date);
                      const durationHours = Math.max(
                        1, 
                        Math.ceil(
                          (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
                        )
                      );
                      
                      return (
                        <div
                          key={event.id}
                          className={`${getEventStyles(event)} p-2 rounded cursor-pointer absolute top-1 left-1 right-1 overflow-hidden`}
                          style={{ 
                            height: `${Math.min(durationHours * (isMobile ? 5 : 6) - 0.5, isMobile ? 4.5 : 5.5)}rem`,
                            zIndex: 10
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                        >
                          <div className="flex items-center">
                            <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
                            <span className="truncate font-medium text-sm">
                              {getEventTitle(event)}
                            </span>
                          </div>
                          {isMobile && (
                            <div className="truncate text-xs">
                              {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                            </div>
                          )}
                          {!isMobile && (
                            <div className="truncate text-xs">
                              {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Month view (default)
  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {/* Weekday headers */}
      <div className="col-span-7 grid grid-cols-7 bg-white">
        {weekDays.map((day) => (
          <div key={day} className="p-1 text-center font-semibold text-sm">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar days grid */}
      {days.map((day) => (
        <div
          key={day.toISOString()}
          className={`bg-white p-2 min-h-[80px] cursor-pointer hover:bg-gray-50 ${
            !isSameMonth(day, selectedDate) ? "text-gray-400" : ""
          } flex flex-col`}
          onClick={() => onDayClick?.(day)}
        >
          <div className="font-medium text-center text-base">
            {format(day, "d")}
          </div>
          <div className="flex-grow space-y-1 overflow-hidden mt-1">
            {events
              .filter((event) => isSameDay(new Date(event.start_date), day))
              .slice(0, 3) // Show max 3 events per day on mobile
              .map((event) => (
                <div
                  key={event.id}
                  className={`text-[10px] p-1 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                >
                  <CalendarIcon className="h-2 w-2 mr-0.5 shrink-0 hidden sm:inline" />
                  <span className="truncate font-medium">
                    {getEventTitle(event)}
                  </span>
                </div>
              ))}
            {/* Show indicator if there are more events than can be displayed */}
            {events.filter((event) => isSameDay(new Date(event.start_date), day)).length > 3 && (
              <div className="text-[8px] text-center text-gray-500">
                +{events.filter((event) => isSameDay(new Date(event.start_date), day)).length - 3} more
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
