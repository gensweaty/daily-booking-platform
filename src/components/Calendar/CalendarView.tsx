import { format, isSameDay, parseISO } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  selectedDate: Date;
  view: "month" | "week" | "day";
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEventType) => void;
}

export const CalendarView = ({
  days,
  events,
  selectedDate,
  view,
  onDayClick,
  onEventClick,
}: CalendarViewProps) => {
  if (view === "month") {
    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden text-sm sm:text-base">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="bg-white dark:bg-gray-800 p-2 sm:p-4 text-center font-semibold text-foreground">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dayEvents = events.filter((event) => 
            isSameDay(parseISO(event.start_date), day)
          );

          return (
            <div
              key={day.toISOString()}
              className="bg-white dark:bg-gray-800 p-2 sm:p-4 min-h-[80px] sm:min-h-[120px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => onDayClick(day)}
            >
              <div className="font-medium text-foreground">{format(day, "d")}</div>
              <div className="mt-1 sm:mt-2 space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs sm:text-sm p-1 rounded ${
                      event.type === "meeting"
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100"
                        : "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-100"
                    } cursor-pointer truncate`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex-1 grid" style={{ 
      gridTemplateColumns: `repeat(${view === 'week' ? 7 : 1}, 1fr)` 
    }}>
      <div className="contents">
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-gray-200 p-1 sm:p-2 text-center bg-white">
            <div className="font-semibold text-sm">{format(day, "EEE")}</div>
            <div className="text-xs text-gray-500">{format(day, "MMM d")}</div>
          </div>
        ))}
      </div>
      
      <div className="contents">
        {days.map((day) => (
          <div key={day.toISOString()} className="relative border-r border-gray-200">
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                className="h-20 border-b border-gray-100"
                onClick={() => {
                  const date = new Date(day);
                  date.setHours(hour);
                  onDayClick(date);
                }}
              />
            ))}
            {events
              .filter((event) => isSameDay(parseISO(event.start_date), day))
              .map((event) => {
                const start = parseISO(event.start_date);
                const end = parseISO(event.end_date);
                const top = (start.getHours() + start.getMinutes() / 60) * 80;
                const height = ((end.getHours() + end.getMinutes() / 60) - 
                              (start.getHours() + start.getMinutes() / 60)) * 80;
                
                return (
                  <div
                    key={event.id}
                    className={`absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded px-1 sm:px-2 py-1 text-xs sm:text-sm ${
                      event.type === "meeting"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    } cursor-pointer overflow-hidden`}
                    style={{
                      top: `${top}px`,
                      height: `${Math.max(height, 20)}px`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="font-semibold truncate">{event.title}</div>
                    {height > 40 && (
                      <div className="text-[10px] sm:text-xs truncate">
                        {format(start, "h:mm a")} - {format(end, "h:mm a")}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
};