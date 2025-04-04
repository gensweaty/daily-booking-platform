
import { format, isSameDay, parseISO, isSameMonth, endOfMonth, startOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  selectedDate: Date;
  view: "month" | "week" | "day";
  onDayClick?: (date: Date, hour?: number) => void;
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
  const { language } = useLanguage();
  const locale = language === 'es' ? es : undefined;

  const weekDays = language === 'es' 
    ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const renderDayHeader = (day: string) => (
    <div key={day} className="bg-background p-0.5 sm:p-4 text-center font-semibold text-foreground border-b border-border">
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

  // Function to determine event color based on type
  const getEventColorClass = (eventType: string) => {
    switch (eventType) {
      case "birthday":
        return "bg-primary text-primary-foreground";
      case "booking_request":
        return "bg-green-600 text-white";
      case "private_party":
        return "bg-amber-500 text-black";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  // Function to get event icon based on type
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "booking_request":
        return "📅 ";
      case "birthday":
        return "🎂 ";
      case "private_party":
        return "🎉 ";
      default:
        return "";
    }
  };

  // Debug log to check events
  console.log(`[CalendarView] Received ${events?.length || 0} events for rendering`);
  if (events?.length > 0) {
    console.log("[CalendarView] First event:", events[0]);
  }

  // Validate events have proper dates
  const validEvents = events.filter(event => {
    try {
      if (!event.start_date || !event.end_date) {
        console.warn("Event missing dates:", event);
        return false;
      }
      
      // Ensure dates are valid
      const startDate = typeof event.start_date === 'string' ? parseISO(event.start_date) : event.start_date;
      const endDate = typeof event.end_date === 'string' ? parseISO(event.end_date) : event.end_date;
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn("Event has invalid dates:", event);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error validating event dates:", error, event);
      return false;
    }
  });
  
  if (validEvents.length !== events.length) {
    console.warn(`[CalendarView] Filtered out ${events.length - validEvents.length} events with invalid dates`);
  }

  if (view === "month") {
    // Get the start and end of the month view
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    // Get all days that should be shown in the calendar grid
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-sm sm:text-base">
        {weekDays.map(renderDayHeader)}
        {calendarDays.map((day) => {
          const dayEvents = validEvents.filter((event) => {
            try {
              const startDate = typeof event.start_date === 'string' ? parseISO(event.start_date) : event.start_date;
              return isSameDay(startDate, day);
            } catch (error) {
              console.error("Error filtering events for day:", error, event);
              return false;
            }
          });
          
          const isCurrentMonth = isSameMonth(day, selectedDate);

          return (
            <div
              key={day.toISOString()}
              className={`relative bg-background p-2 sm:p-4 min-h-[80px] sm:min-h-[120px] ${
                onDayClick ? 'cursor-pointer hover:bg-muted' : ''
              } border border-border transition-colors ${
                !isCurrentMonth ? 'bg-opacity-50' : ''
              }`}
              onClick={onDayClick ? () => onDayClick(day) : undefined}
            >
              <div className={`font-medium ${!isCurrentMonth ? 'text-muted-foreground' : 'text-foreground'}`}>
                {format(day, "d")}
              </div>
              <div className="mt-1 sm:mt-2 space-y-1">
                {dayEvents.length > 0 && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                  </div>
                )}
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs sm:text-sm p-1 rounded ${
                      getEventColorClass(event.type)
                    } cursor-pointer truncate hover:opacity-80 transition-opacity ${
                      !isCurrentMonth ? 'opacity-60' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    title={event.title}
                  >
                    {getEventIcon(event.type)}{event.title}
                    {event.requester_name && <span className="block text-[9px] italic truncate">({event.requester_name})</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Week/Day view with time slots
  return (
    <div className="flex-1 grid bg-background rounded-lg overflow-y-auto" 
         style={{ gridTemplateColumns: `repeat(${view === 'week' ? 7 : 1}, 1fr)` }}>
      <div className="contents">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className="bg-background px-0.5 sm:px-4 py-2 text-center border-b border-border h-20"
          >
            <div className="font-semibold text-xs sm:text-sm text-foreground">
              {format(day, "EEE", { locale })}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              {format(day, "MMM d", { locale })}
            </div>
          </div>
        ))}
      </div>
      
      <div className="contents">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className="relative bg-background border-r border-l border-border min-w-[35px]"
          >
            {Array.from({ length: 24 }).map((_, index) => {
              const actualHour = displayHourToActualHour(index);
              const hourDate = new Date(day);
              hourDate.setHours(actualHour, 0, 0, 0);
              
              return (
                <div
                  key={actualHour}
                  className={`h-20 border-b border-border ${
                    onDayClick ? 'hover:bg-muted transition-colors cursor-pointer' : ''
                  } relative`}
                  onClick={onDayClick ? () => onDayClick(hourDate, actualHour) : undefined}
                />
              );
            })}
            
            {validEvents
              .filter((event) => {
                try {
                  const startDate = typeof event.start_date === 'string' ? parseISO(event.start_date) : event.start_date;
                  return isSameDay(startDate, day);
                } catch (error) {
                  console.error("Error filtering events for day:", error, event);
                  return false;
                }
              })
              .map((event) => {
                try {
                  const start = new Date(event.start_date);
                  const end = new Date(event.end_date);
                  
                  // Skip invalid dates
                  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    return null;
                  }
                  
                  const top = actualHourToDisplayPosition(start.getHours()) + 
                            (start.getMinutes() / 60) * 80;
                  const height = (end.getHours() - start.getHours() + 
                                (end.getMinutes() - start.getMinutes()) / 60) * 80;
                  
                  return (
                    <div
                      key={event.id}
                      className={`absolute left-0.5 right-0.5 rounded px-0.5 sm:px-2 py-1 text-[10px] sm:text-sm ${
                        getEventColorClass(event.type)
                      } cursor-pointer overflow-hidden hover:opacity-80 transition-opacity`}
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 20)}px`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      title={`${event.title} ${event.requester_name ? `(${event.requester_name})` : ''}`}
                    >
                      <div className="font-semibold truncate">
                        {getEventIcon(event.type)}{event.title}
                      </div>
                      {height > 40 && (
                        <div className="text-[8px] sm:text-xs truncate">
                          {format(start, "h:mm a", { locale })} - {format(end, "h:mm a", { locale })}
                          {event.requester_name && (
                            <div className="italic">{event.requester_name}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                } catch (error) {
                  console.error("Error rendering event:", error, event);
                  return null;
                }
              })
              .filter(Boolean)}
          </div>
        ))}
      </div>
    </div>
  );
};
