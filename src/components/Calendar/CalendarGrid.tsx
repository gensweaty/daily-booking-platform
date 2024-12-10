import { format, isSameDay, isSameMonth } from "date-fns";
import { CalendarEvent } from "@/lib/types";

interface CalendarGridProps {
  days: Date[];
  events: CalendarEvent[];
  selectedDate: Date;
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export const CalendarGrid = ({
  days,
  events,
  selectedDate,
  onDayClick,
  onEventClick,
}: CalendarGridProps) => {
  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
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
          onClick={() => onDayClick(day)}
        >
          <div className="font-medium">{format(day, "d")}</div>
          <div className="mt-2 space-y-1">
            {events
              .filter((event) => isSameDay(new Date(event.start_date), day))
              .map((event) => (
                <div
                  key={event.id}
                  className="text-sm p-1 rounded bg-secondary text-secondary-foreground cursor-pointer truncate hover:opacity-80 transition-opacity"
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
      ))}
    </div>
  );
};