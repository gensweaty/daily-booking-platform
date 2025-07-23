
import React from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarGridProps {
  currentDate: Date;
  events: CalendarEventType[];
  onEventClick: (event: CalendarEventType) => void;
  onDayClick: (date: Date) => void;
}

export const CalendarGrid = ({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: CalendarGridProps) => {
  const { t } = useLanguage();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_date);
      return isSameDay(eventDate, date);
    });
  };

  const getEventTypeColor = (event: CalendarEventType) => {
    // Enhanced type detection for proper styling
    const eventType = event.type || 'event';
    
    switch (eventType) {
      case 'booking_request':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'event':
        return 'bg-green-100 border-green-300 text-green-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const handleEventClick = (event: CalendarEventType, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[CalendarGrid] Event clicked:', {
      id: event.id,
      title: event.title,
      type: event.type,
      originalEvent: event
    });
    onEventClick(event);
  };

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {/* Week day headers */}
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
          {t(`calendar.${day.toLowerCase()}`)}
        </div>
      ))}

      {/* Calendar days */}
      {days.map(day => {
        const dayEvents = getEventsForDay(day);
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isCurrentDay = isToday(day);

        return (
          <div
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            className={cn(
              "min-h-[120px] bg-white p-2 cursor-pointer hover:bg-gray-50 transition-colors",
              !isCurrentMonth && "opacity-40",
              isCurrentDay && "bg-blue-50"
            )}
          >
            <div className={cn(
              "text-sm font-medium mb-1",
              isCurrentDay && "text-blue-600"
            )}>
              {format(day, 'd')}
            </div>
            
            <div className="space-y-1">
              {dayEvents.map((event, index) => (
                <div
                  key={`${event.id}-${index}`}
                  onClick={(e) => handleEventClick(event, e)}
                  className={cn(
                    "text-xs p-1 rounded border cursor-pointer hover:opacity-80 transition-opacity",
                    getEventTypeColor(event)
                  )}
                  title={`${event.title} - ${event.type || 'event'}`}
                >
                  <div className="truncate font-medium">
                    {event.title || event.user_surname}
                  </div>
                  <div className="truncate opacity-75">
                    {format(new Date(event.start_date), 'HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
