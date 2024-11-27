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
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="bg-white p-4 text-center font-semibold">
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
              className="bg-white p-4 min-h-[120px] cursor-pointer hover:bg-gray-50"
              onClick={() => onDayClick(day)}
            >
              <div className="font-medium">{format(day, "d")}</div>
              <div className="mt-2 space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-sm p-1 rounded ${
                      event.type === "meeting"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
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

  // Week and Day views
  return (
    <div className="flex-1 grid" style={{ 
      gridTemplateColumns: `repeat(${view === 'week' ? 7 : 1}, 1fr)` 
    }}>
      {/* Header */}
      <div className="contents">
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-gray-200 p-2 text-center bg-white">
            <div className="font-semibold">{format(day, "EEE")}</div>
            <div className="text-sm text-gray-500">{format(day, "MMM d")}</div>
          </div>
        ))}
      </div>
      
      {/* Time grid */}
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
                    className={`absolute left-1 right-1 rounded px-2 py-1 text-sm ${
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
                      <div className="text-xs truncate">
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