import { format, isSameDay } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEventType) => void;
}

export const CalendarView = ({
  days,
  events,
  onDayClick,
  onEventClick,
}: CalendarViewProps) => {
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
          className="bg-white p-4 min-h-[120px] cursor-pointer hover:bg-gray-50"
          onClick={() => onDayClick(day)}
        >
          <div className="font-medium">{format(day, "d")}</div>
          <div className="mt-2 space-y-1">
            {events
              .filter((event) => isSameDay(new Date(event.start_date), day))
              .map((event) => (
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
      ))}
    </div>
  );
};