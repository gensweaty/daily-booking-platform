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
    <div className="grid grid-cols-7 h-full">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div key={day} className="bg-background p-4 text-center font-semibold border-b border-r border-border">
          {day}
        </div>
      ))}
      {days.map((day, index) => (
        <div
          key={day.toISOString()}
          className={`bg-background p-4 min-h-[120px] cursor-pointer hover:bg-muted border-b border-r border-border overflow-y-auto ${
            !isSameMonth(day, selectedDate) ? "text-muted-foreground" : ""
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
                  className={`text-sm p-1 rounded ${
                    event.type === "birthday" ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"
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
      ))}
    </div>
  );
};