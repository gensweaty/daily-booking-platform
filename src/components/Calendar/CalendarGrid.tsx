
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
    // Always use green for external calendar events
    if (isExternalCalendar) {
      return "bg-green-500 text-white";
    } else {
      // For internal calendar, differentiate event types by color
      switch (event.type) {
        case "booking_request":
          return "bg-green-500 text-white"; // Booking requests are always green
        case "birthday":
          return "bg-blue-100 text-blue-700";
        default:
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
