import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { format, isEqual, isSameDay, isToday, parse } from "date-fns";

interface CalendarGridProps {
  days: Date[];
  events: CalendarEventType[];
  formattedSelectedDate: string;
  view: CalendarViewType;
  onDayClick?: (date: Date, hour?: number) => void;
  onEventClick?: (event: CalendarEventType) => void;
  isExternalCalendar?: boolean;
}

// Helper function to determine if a date has events
const hasEvents = (day: Date, events: CalendarEventType[]): boolean => {
  return events.some(event => {
    const eventStart = new Date(event.start_date);
    return isSameDay(day, eventStart);
  });
};

export function CalendarGrid({
  days,
  events,
  formattedSelectedDate,
  view,
  onDayClick,
  onEventClick,
  isExternalCalendar = false,
}: CalendarGridProps) {
  // Helper to handle day clicks
  const handleDayClick = (day: Date, hour?: number) => {
    if (onDayClick) {
      onDayClick(day, hour);
    }
  };

  // This is a placeholder for the actual grid implementation
  // For this example, I'll just create a simple month view
  return (
    <div className="calendar-grid">
      {view === "month" && (
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const formattedDay = format(day, "yyyy-MM-dd");
            const isSelected = formattedDay === formattedSelectedDate;
            const hasEventsForDay = hasEvents(day, events);
            
            return (
              <div
                key={i}
                className={`
                  aspect-square p-1 relative
                  ${isToday(day) ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                  ${isSelected ? "ring-2 ring-primary" : ""}
                  hover:bg-accent cursor-pointer
                `}
                onClick={() => handleDayClick(day)}
              >
                <div className="text-right">
                  <span
                    className={`
                      inline-block w-7 h-7 rounded-full text-center leading-7
                      ${isToday(day) ? "bg-primary text-primary-foreground" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                
                {hasEventsForDay && (
                  <div className="absolute bottom-1 left-1 right-1">
                    <div className="h-1 bg-blue-500 rounded-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {(view === "week" || view === "day") && (
        <div>
          {/* Implement week/day view as needed */}
          {days.map((day, i) => (
            <div key={i} onClick={() => handleDayClick(day)}>
              {format(day, "EEEE, MMMM d")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
