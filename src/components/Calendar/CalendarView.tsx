import { useState, useEffect, CSSProperties } from "react";
import { format, isToday, isSameDay, isSameMonth, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";

interface CalendarViewProps {
  view: CalendarViewType;
  days: Date[];
  events?: CalendarEventType[];
  selectedDate: Date;
  onDayClick?: (date: Date, hour?: number) => void;
  onEventClick?: (event: CalendarEventType) => void;
  isExternalCalendar?: boolean;
}

export const CalendarView = ({
  view,
  days,
  events = [],
  selectedDate,
  onDayClick,
  onEventClick,
  isExternalCalendar = false,
}: CalendarViewProps) => {
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";
  const { user } = useAuth();
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  const handleDayClick = (day: Date, hour?: number) => {
    if (onDayClick) {
      onDayClick(day, hour);
    }
  };

  const getEventStyle = (event: CalendarEventType): CSSProperties => {
    // Default colors 
    let backgroundColor = "#9b87f5"; // Default purple for most events
    let textColor = "white";
    let borderColor = "transparent";
    
    // Color mapping based on event type
    // IMPORTANT: booking_request type should be green
    if (event.type === "booking_request") {
      backgroundColor = "#4ade80"; // Green for booking requests
    } else if (event.type === "birthday") {
      backgroundColor = "#f87171"; // Red for birthdays
    } else if (event.type === "private_party") {
      backgroundColor = "#fb923c"; // Orange for private parties
    }
    
    // Apply darker colors for dark theme
    if (isDarkTheme) {
      backgroundColor = event.type === "booking_request" 
        ? "#22c55e" 
        : (event.type === "birthday" 
          ? "#dc2626" 
          : (event.type === "private_party"
            ? "#ea580c"
            : "#8b5cf6")); // Purple for dark theme
    }
    
    // For external calendar, make booking_request events more visible
    if (isExternalCalendar && event.type === "booking_request") {
      backgroundColor = "#10b981"; // Different green for external view
      borderColor = "#047857";
    }
    
    return {
      backgroundColor,
      color: textColor,
      borderColor
    };
  };

  const renderMonthView = () => {
    return (
      <div className="grid grid-cols-7 gap-px h-full">
        {days.map((day) => {
          const isTodayDay = isToday(day);
          const isSelectedDay = isSameDay(day, selectedDate);
          const isCurrentMonthDay = isSameMonth(day, selectedDate);

          const dayEvents = events.filter((event) =>
            isSameDay(new Date(event.start_date), day)
          );

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "relative p-2",
                isTodayDay && "font-semibold",
                isSelectedDay && "bg-secondary/50",
                !isCurrentMonthDay && "opacity-50",
                "hover:bg-accent/50 cursor-pointer",
                isDarkTheme ? "border-gray-800" : "border-gray-200",
                "border"
              )}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm">{format(day, "d")}</span>
                {isTodayDay && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="mt-2 space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-1 text-xs font-medium rounded cursor-pointer truncate"
                    style={getEventStyle(event)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
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
  };

  const renderWeekView = () => {
    return (
      <div className="flex h-full">
        {days.map((day) => {
          const isTodayDay = isToday(day);
          const isSelectedDay = isSameDay(day, selectedDate);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "relative w-full border border-gray-200 hover:bg-accent/50 cursor-pointer",
                isTodayDay && "font-semibold",
                isSelectedDay && "bg-secondary/50",
                isDarkTheme ? "border-gray-800" : "border-gray-200",
                "border"
              )}
            >
              <div className="p-2">
                <span className="text-sm">{format(day, "EEE d")}</span>
                {isTodayDay && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex flex-col h-full">
                {Array.from({ length: 24 }, (_, i) => {
                  const hourStart = new Date(day);
                  hourStart.setHours(i, 0, 0, 0);

                  const hourEnd = new Date(day);
                  hourEnd.setHours(i + 1, 0, 0, 0);

                  const hourEvents = events.filter((event) => {
                    const eventStart = new Date(event.start_date);
                    return (
                      isSameDay(eventStart, day) &&
                      eventStart >= hourStart &&
                      eventStart < hourEnd
                    );
                  });

                  return (
                    <div
                      key={i}
                      className="relative h-10 border-b border-gray-200 last:border-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(day, i);
                      }}
                    >
                      {hourEvents.map((event) => (
                        <div
                          key={event.id}
                          className="absolute top-0 left-0 w-full h-1/2 p-1 text-xs font-medium rounded cursor-pointer truncate"
                          style={getEventStyle(event)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const day = days[0];
    const isTodayDay = isToday(day);
    const isSelectedDay = isSameDay(day, selectedDate);

    return (
      <div
        key={day.toISOString()}
        className={cn(
          "relative w-full border border-gray-200 hover:bg-accent/50 cursor-pointer",
          isTodayDay && "font-semibold",
          isSelectedDay && "bg-secondary/50",
          isDarkTheme ? "border-gray-800" : "border-gray-200",
          "border"
        )}
      >
        <div className="p-2">
          <span className="text-sm">{format(day, "EEE d")}</span>
          {isTodayDay && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <div className="flex flex-col h-full">
          {Array.from({ length: 24 }, (_, i) => {
            const hourStart = new Date(day);
            hourStart.setHours(i, 0, 0, 0);

            const hourEnd = new Date(day);
            hourEnd.setHours(i + 1, 0, 0, 0);

            const hourEvents = events.filter((event) => {
              const eventStart = new Date(event.start_date);
              return (
                isSameDay(eventStart, day) &&
                eventStart >= hourStart &&
                eventStart < hourEnd
              );
            });

            return (
              <div
                key={i}
                className="relative h-10 border-b border-gray-200 last:border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDayClick(day, i);
                }}
              >
                {hourEvents.map((event) => (
                  <div
                    key={event.id}
                    className="absolute top-0 left-0 w-full h-1/2 p-1 text-xs font-medium rounded cursor-pointer truncate"
                    style={getEventStyle(event)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      {view === "month" && renderMonthView()}
      {view === "week" && renderWeekView()}
      {view === "day" && renderDayView()}
    </div>
  );
};
