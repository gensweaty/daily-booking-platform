import { format, isSameDay, parseISO, isSameMonth, endOfMonth, startOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  selectedDate: Date;
  view: "month" | "week" | "day";
  onDayClick: (date: Date, hour?: number) => void;
  onEventClick: (event: CalendarEventType) => void;
  publicMode?: boolean;
}

export const CalendarView = ({
  days,
  events,
  selectedDate,
  view,
  onDayClick,
  onEventClick,
  publicMode = false,
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

  const displayHourToActualHour = (displayIndex: number) => {
    return (displayIndex + 6) % 24;
  };

  const actualHourToDisplayPosition = (actualHour: number) => {
    return ((actualHour - 6 + 24) % 24) * 80;
  };

  const safeParseDate = (dateStr: string | Date): Date | null => {
    if (!dateStr) return null;
    
    try {
      if (dateStr instanceof Date) return dateStr;
      
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
      
      const isoParsed = parseISO(dateStr);
      if (!isNaN(isoParsed.getTime())) {
        return isoParsed;
      }
      
      console.error("[CalendarView] Invalid date format:", dateStr);
      return null;
    } catch (err) {
      console.error("[CalendarView] Error parsing date:", err, dateStr);
      return null;
    }
  };

  const validEvents = events?.filter(event => {
    const startDate = safeParseDate(event.start_date);
    return !!startDate;
  }) || [];

  console.log(`[CalendarView] Rendering with ${validEvents.length} events in ${publicMode ? 'public' : 'private'} mode`);
  if (validEvents.length > 0) {
    console.log("[CalendarView] First few events:", 
      validEvents.slice(0, 3).map(e => ({
        id: e.id,
        title: e.title,
        start: e.start_date
      }))
    );
  }

  const getEventDisplayTitle = (event: CalendarEventType) => {
    return publicMode ? "Booked" : event.title;
  };

  if (view === "month") {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-sm sm:text-base">
        {weekDays.map(renderDayHeader)}
        {calendarDays.map((day) => {
          const dayEvents = validEvents.filter(event => {
            const eventDate = safeParseDate(event.start_date);
            return eventDate && isSameDay(eventDate, day);
          });
          
          const isCurrentMonth = isSameMonth(day, selectedDate);

          return (
            <div
              key={day.toISOString()}
              className={`relative bg-background p-2 sm:p-4 min-h-[80px] sm:min-h-[120px] cursor-pointer hover:bg-muted border border-border transition-colors ${
                !isCurrentMonth ? 'bg-opacity-50' : ''
              }`}
              onClick={() => onDayClick(day)}
            >
              <div className={`font-medium ${!isCurrentMonth ? 'text-muted-foreground' : 'text-foreground'}`}>
                {format(day, "d")}
              </div>
              <div className="mt-1 sm:mt-2 space-y-1">
                {dayEvents.length > 0 && dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs sm:text-sm p-1 rounded ${
                      event.type === "birthday"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    } ${!publicMode ? 'cursor-pointer' : ''} truncate hover:opacity-80 transition-opacity ${
                      !isCurrentMonth ? 'opacity-60' : ''
                    }`}
                    onClick={(e) => {
                      if (publicMode) return;
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    {getEventDisplayTitle(event)}
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
                  className="h-20 border-b border-border hover:bg-muted transition-colors cursor-pointer relative"
                  onClick={() => onDayClick(hourDate, actualHour)}
                />
              );
            })}
            
            {validEvents
              .filter(event => {
                const eventDate = safeParseDate(event.start_date);
                return eventDate && isSameDay(eventDate, day);
              })
              .map((event) => {
                const start = safeParseDate(event.start_date) || new Date();
                const end = safeParseDate(event.end_date) || new Date(start.getTime() + 60 * 60 * 1000);
                
                const top = actualHourToDisplayPosition(start.getHours()) + 
                          (start.getMinutes() / 60) * 80;
                const height = (end.getHours() - start.getHours() + 
                              (end.getMinutes() - start.getMinutes()) / 60) * 80;
                
                return (
                  <div
                    key={event.id}
                    className={`absolute left-0.5 right-0.5 rounded px-0.5 sm:px-2 py-1 text-[10px] sm:text-sm ${
                      event.type === "birthday"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    } ${!publicMode ? 'cursor-pointer' : ''} overflow-hidden hover:opacity-80 transition-opacity`}
                    style={{
                      top: `${top}px`,
                      height: `${Math.max(height, 20)}px`,
                    }}
                    onClick={(e) => {
                      if (publicMode) return;
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="font-semibold truncate">
                      {getEventDisplayTitle(event)}
                    </div>
                    {height > 40 && (
                      <div className="text-[8px] sm:text-xs truncate">
                        {format(start, "h:mm a", { locale })} - {format(end, "h:mm a", { locale })}
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
