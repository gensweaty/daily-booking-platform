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
  const renderDayHeader = (day: string) => (
    <div key={day} className="bg-[#1e2330] p-2 sm:p-4 text-center font-semibold text-white">
      {day}
    </div>
  );

  if (view === "month") {
    return (
      <div className="grid grid-cols-7 gap-px bg-[#1e2330] rounded-lg overflow-hidden text-sm sm:text-base">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(renderDayHeader)}
        {days.map((day) => {
          const dayEvents = events.filter((event) => 
            isSameDay(parseISO(event.start_date), day)
          );

          return (
            <div
              key={day.toISOString()}
              className="bg-[#1e2330] p-2 sm:p-4 min-h-[80px] sm:min-h-[120px] cursor-pointer hover:bg-[#252b3b] border border-[#2a3142]"
              onClick={() => onDayClick(day)}
            >
              <div className="font-medium text-white">{format(day, "d")}</div>
              <div className="mt-1 sm:mt-2 space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs sm:text-sm p-1 rounded ${
                      event.type === "meeting"
                        ? "bg-[#4338ca] text-white"
                        : "bg-[#7c3aed] text-white"
                    } cursor-pointer truncate hover:opacity-80 transition-opacity`}
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
    <div className="flex-1 grid bg-[#1e2330] rounded-lg overflow-y-auto" 
         style={{ gridTemplateColumns: `repeat(${view === 'week' ? 7 : 1}, 1fr)` }}>
      <div className="contents">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className="bg-[#1e2330] p-2 sm:p-4 text-center border-b border-[#2a3142]"
          >
            <div className="font-semibold text-sm text-white">{format(day, "EEE")}</div>
            <div className="text-xs text-gray-400">{format(day, "MMM d")}</div>
          </div>
        ))}
      </div>
      
      <div className="contents">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className="relative bg-[#1e2330] border-r border-[#2a3142]"
          >
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                className="h-20 border-b border-[#2a3142] hover:bg-[#252b3b] transition-colors cursor-pointer"
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
                        ? "bg-[#4338ca] text-white"
                        : "bg-[#7c3aed] text-white"
                    } cursor-pointer overflow-hidden hover:opacity-80 transition-opacity`}
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