
// Classic minimal calendar grid: plain cells, minimal styling, no extra icons or group badges
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

  return (
    <div className="w-full max-w-3xl mx-auto p-2">
      <div className="grid grid-cols-7 border bg-white rounded overflow-hidden shadow">
        {/* Week Header */}
        {weekDays.map(day => (
          <div key={day} className="text-xs font-semibold py-2 text-center bg-gray-50 border-b">
            {day}
          </div>
        ))}
        {/* Days */}
        {daysInMonth.map((date, idx) => {
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();
          const today = isToday(date);
          const dayEvents = getEventsForDate(date);
          return (
            <div
              key={idx}
              onClick={() => onDateClick(date)}
              className={`
                cursor-pointer min-h-[70px] border-b border-r last:border-r-0 p-1
                ${!isCurrentMonth ? 'bg-gray-100 text-gray-400' : ''}
                ${today ? 'bg-blue-100' : ''}
                relative hover:bg-blue-50 transition
              `}
            >
              <div className={`text-sm font-medium ${today ? 'text-blue-700' : ''}`}>{format(date, 'd')}</div>
              {/* Show up to 2 events */}
              <div className="space-y-1 pt-1">
                {dayEvents.slice(0,2).map(ev => (
                  <div
                    key={ev.id}
                    className="text-xs bg-blue-200 rounded px-1 py-0.5 truncate cursor-pointer hover:bg-blue-300"
                    onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                  >
                    {ev.is_group_event ? ev.group_name : ev.title}
                  </div>
                ))}
                {dayEvents.length > 2 && <div className="text-[10px] text-gray-500 font-medium">+{dayEvents.length-2} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
