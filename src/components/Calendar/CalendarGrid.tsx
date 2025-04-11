
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
    // Reorder hours to start from 6 AM to match the TimeIndicator component
    const HOURS = [
      ...Array.from({ length: 18 }, (_, i) => i + 6), // 6 AM to 23 PM
      ...Array.from({ length: 6 }, (_, i) => i) // 0 AM to 5 AM
    ];
    
    // Different layouts for mobile vs desktop
    return (
      <div className="grid grid-cols-1 h-full overflow-y-auto">
        <div className="grid" style={{ 
          gridTemplateRows: `repeat(${HOURS.length}, 6rem)`,
          height: `${HOURS.length * 6}rem`
        }}>
          {HOURS.map((hourIndex, rowIndex) => (
            <div 
              key={hourIndex} 
              className="grid border-b border-gray-200"
              style={{ 
                gridTemplateColumns: view === 'day' ? '1fr' : 'repeat(7, 1fr)',
                height: '6rem'
              }}
            >
              {/* Mobile Time Indicators - Only visible on mobile */}
              {isMobile && (
                <div className="absolute left-0 text-[10px] text-gray-500" style={{ top: `${rowIndex * 6}rem` }}>
                  {hourIndex === 0 ? "12 AM" : 
                   hourIndex === 12 ? "12 PM" : 
                   hourIndex < 12 ? `${hourIndex} AM` : `${hourIndex - 12} PM`}
                </div>
              )}
              
              {days.map((day) => (
                <div
                  key={`${day.toISOString()}-${hourIndex}`}
                  className={`border-r border-gray-200 p-1 relative ${
                    !isMobile ? "" : "ml-8"
                  } ${
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
                            height: `${Math.min(durationHours * 6 - 0.5, 5.5)}rem`,
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
                          <div className="truncate text-xs">
                            {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                          </div>
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

  // Month view (default) - Updated for better mobile experience
  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {/* Weekday headers */}
      <div className="col-span-7 grid grid-cols-7 bg-white">
        {weekDays.map((day) => (
          <div key={day} className="p-1 text-center font-semibold text-xs md:text-sm md:p-4">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar days grid - Updated for better mobile layout */}
      {days.map((day) => (
        <div
          key={day.toISOString()}
          className={`bg-white p-0.5 md:p-4 min-h-[80px] md:min-h-[120px] cursor-pointer hover:bg-gray-50 ${
            !isSameMonth(day, selectedDate) ? "text-gray-400" : ""
          } flex flex-col`}
          onClick={() => onDayClick?.(day)}
        >
          <div className="font-medium text-center md:text-left text-xs md:text-base p-0.5">
            {format(day, "d")}
          </div>
          <div className="flex-grow space-y-0.5 md:space-y-1 overflow-hidden">
            {events
              .filter((event) => isSameDay(new Date(event.start_date), day))
              .slice(0, 3) // Show max 3 events per day on mobile
              .map((event) => (
                <div
                  key={event.id}
                  className={`text-[10px] md:text-sm p-0.5 md:p-1.5 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                >
                  <CalendarIcon className="h-2 w-2 mr-0.5 shrink-0 hidden sm:inline md:h-3 md:w-3 md:mr-1" />
                  <span className="truncate font-medium">
                    {getEventTitle(event)}
                  </span>
                </div>
              ))}
            {/* Show indicator if there are more events than can be displayed */}
            {events.filter((event) => isSameDay(new Date(event.start_date), day)).length > 3 && (
              <div className="text-[8px] md:text-xs text-center text-gray-500">
                +{events.filter((event) => isSameDay(new Date(event.start_date), day)).length - 3} more
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
