import { format, isSameDay, parseISO } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  selectedDate: Date;
  view: "month" | "week" | "day";
  onDayClick: (date: Date, hour?: number) => void;
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
    <div key={day} className="bg-background p-2 sm:p-4 text-center font-semibold text-foreground border-b border-border">
      {day}
    </div>
  );

  // Function to convert display hour to actual hour
  const displayHourToActualHour = (displayIndex: number) => {
    return (displayIndex + 6) % 24;
  };

  // Function to convert actual hour to display position
  const actualHourToDisplayPosition = (actualHour: number) => {
    return ((actualHour - 6 + 24) % 24) * 80; // 80px is the height of each hour slot
  };

  if (view === "month") {
    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-sm sm:text-base">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(renderDayHeader)}
        {days.map((day) => {
          const dayEvents = events.filter((event) => 
            isSameDay(parseISO(event.start_date), day)
          );

          return (
            <div
              key={day.toISOString()}
              className="bg-background p-2 sm:p-4 min-h-[80px] sm:min-h-[120px] cursor-pointer hover:bg-muted border border-border"
              onClick={() => onDayClick(day)}
            >
              <div className="font-medium text-foreground">{format(day, "d")}</div>
              <div className="mt-1 sm:mt-2 space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs sm:text-sm p-1 rounded ${
                      event.type === "birthday"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
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

  // Week/Day view with time slots starting from 6 AM
  return (
    <div className="flex-1 grid bg-background rounded-lg overflow-y-auto" 
         style={{ gridTemplateColumns: `repeat(${view === 'week' ? 7 : 1}, 1fr)` }}>
      <div className="contents">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className="bg-background p-2 sm:p-4 text-center border-b border-border h-20"
          >
            <div className="font-semibold text-sm text-foreground">{format(day, "EEE")}</div>
            <div className="text-xs text-muted-foreground">{format(day, "MMM d")}</div>
          </div>
        ))}
      </div>
      
      <div className="contents">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className="relative bg-background border-r border-l border-border"
          >
            {Array.from({ length: 24 }).map((_, index) => {
              const actualHour = displayHourToActualHour(index);
              const hourDate = new Date(day);
              hourDate.setHours(actualHour, 0, 0, 0);
              
              return (
                <div
                  key={actualHour}
                  className="h-20 border-b border-border hover:bg-muted transition-colors cursor-pointer relative"
                  onClick={() => onDayClick(hourDate, actualHour)}
                />
              );
            })}
            
            {events
              .filter((event) => isSameDay(parseISO(event.start_date), day))
              .map((event) => {
                const start = new Date(event.start_date);
                const end = new Date(event.end_date);
                const top = actualHourToDisplayPosition(start.getHours()) + 
                          (start.getMinutes() / 60) * 80;
                const height = (end.getHours() - start.getHours() + 
                              (end.getMinutes() - start.getMinutes()) / 60) * 80;
                
                return (
                  <div
                    key={event.id}
                    className={`absolute left-0.5 right-0.5 rounded px-1 sm:px-2 py-1 text-xs sm:text-sm ${
                      event.type === "birthday"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
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