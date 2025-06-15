
import { CalendarEventType } from '@/lib/types/calendar';
import { format, isToday, isSameDay } from 'date-fns';

interface CalendarGridProps {
  currentDate: Date;
  events: CalendarEventType[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEventType) => void;
  getDaysInMonth: (date: Date) => Date[];
}

export const CalendarGrid = ({
  currentDate,
  events,
  onDateClick,
  onEventClick,
  getDaysInMonth
}: CalendarGridProps) => {
  const daysInMonth = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_date);
      return isSameDay(eventDate, date) && !event.deleted_at;
    });
  };

  const renderEventBadge = (event: CalendarEventType) => {
    return (
      <div
        key={event.id}
        onClick={(e) => {
          e.stopPropagation();
          onEventClick(event);
        }}
        className="p-1 text-xs rounded cursor-pointer hover:opacity-80 transition-opacity bg-blue-100 text-blue-800"
      >
        <div className="truncate">
          {event.is_group_event ? event.group_name : event.title}
        </div>
        <div className="text-xs opacity-75">
          {format(new Date(event.start_date), 'HH:mm')}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-7 gap-1 p-4">
      {/* Week days header */}
      {weekDays.map((day) => (
        <div key={day} className="p-2 text-center font-semibold text-gray-600 border-b">
          {day}
        </div>
      ))}

      {/* Calendar days */}
      {daysInMonth.map((date, index) => {
        const dayEvents = getEventsForDate(date);
        const isCurrentDay = isToday(date);
        const isCurrentMonth = date.getMonth() === currentDate.getMonth();

        return (
          <div
            key={index}
            onClick={() => onDateClick(date)}
            className={`min-h-[100px] p-1 border cursor-pointer hover:bg-gray-50 transition-colors ${
              isCurrentDay ? 'bg-blue-50 border-blue-200' : ''
            } ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}`}
          >
            <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-blue-600' : ''}`}>
              {format(date, 'd')}
            </div>
            
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map(renderEventBadge)}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-500 text-center">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
