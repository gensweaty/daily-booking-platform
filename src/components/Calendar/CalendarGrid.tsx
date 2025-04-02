
import { format, isSameDay, isSameMonth, startOfWeek, addDays } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { Calendar as CalendarIcon } from "lucide-react";

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
    if (event.type === "booking_request") {
      return "bg-green-500 text-white"; // Booking requests are always green
    } else if (event.type === "birthday") {
      return "bg-blue-100 text-blue-700";
    } else {
      return "bg-purple-100 text-purple-700";
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
    
    return (
      <div className="grid grid-cols-1 md:grid-rows-24 h-full overflow-y-auto">
        {/* Render a grid with hours */}
        {HOURS.map((hourIndex) => (
          <div 
            key={hourIndex} 
            className="grid grid-cols-7 border-b border-gray-200 h-20"
            style={{ gridTemplateColumns: view === 'day' ? '1fr' : 'repeat(7, 1fr)' }}
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
                        className={`${getEventStyles(event)} p-1 text-xs rounded cursor-pointer mb-1 absolute top-1 left-1 right-1`}
                        style={{ 
                          height: `${Math.min(durationHours * 20 - 2, 24 * 20 - hourIndex * 20 - 2)}px`,
                          zIndex: 10
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      >
                        <div className="flex items-center">
                          <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
                          <span className="truncate font-medium">
                            {getEventTitle(event)}
                          </span>
                        </div>
                        <div className="truncate">
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
    );
  }

  // Month view (default)
  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {weekDays.map((day) => (
        <div key={day} className="bg-white p-4 text-center font-semibold">
          {day}
        </div>
      ))}
      {days.map((day) => (
        <div
          key={day.toISOString()}
          className={`bg-white p-4 min-h-[120px] cursor-pointer hover:bg-gray-50 ${
            !isSameMonth(day, selectedDate) ? "text-gray-400" : ""
          }`}
          onClick={() => onDayClick?.(day)}
        >
          <div className="font-medium">{format(day, "d")}</div>
          <div className="mt-2 space-y-1">
            {events
              .filter((event) => isSameDay(new Date(event.start_date), day))
              .map((event) => (
                <div
                  key={event.id}
                  className={`text-sm p-1.5 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                >
                  <CalendarIcon className="h-3 w-3 mr-1.5 shrink-0" />
                  <span className="truncate font-medium">
                    {getEventTitle(event)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};
