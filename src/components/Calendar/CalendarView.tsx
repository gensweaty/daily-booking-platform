
import { Fragment } from "react";
import { format } from "date-fns";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  selectedDate: Date;
  view: CalendarViewType;
  onDayClick?: (date: Date, hour?: number) => void;
  onEventClick?: (event: CalendarEventType) => void;
  isExternalCalendar?: boolean;
}

export const CalendarView = ({
  days,
  events,
  selectedDate,
  view,
  onDayClick,
  onEventClick,
  isExternalCalendar = false,
}: CalendarViewProps) => {
  const getEvents = (day: Date): CalendarEventType[] => {
    return events.filter((event) => {
      const startDate = new Date(event.start_date);
      const eventDay = startDate.getDate();
      const eventMonth = startDate.getMonth();
      const eventYear = startDate.getFullYear();

      return (
        eventDay === day.getDate() &&
        eventMonth === day.getMonth() &&
        eventYear === day.getFullYear()
      );
    });
  };

  const getDayClassName = (day: Date): string => {
    const isToday =
      day.getDate() === new Date().getDate() &&
      day.getMonth() === new Date().getMonth() &&
      day.getFullYear() === new Date().getFullYear();

    const isSelected =
      day.getDate() === selectedDate.getDate() &&
      day.getMonth() === selectedDate.getMonth() &&
      day.getFullYear() === selectedDate.getFullYear();

    return `day-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`;
  };

  const getEventClassName = (event: CalendarEventType): string => {
    const baseClass = "cursor-pointer p-1 rounded mb-1 text-xs overflow-hidden";
    
    // Restore original color scheme
    if (event.type === 'booking_request') {
      // Use green for booking requests both in external and personal calendar
      return `${baseClass} bg-green-500 text-white`;
    } else if (event.type === 'birthday') {
      return `${baseClass} bg-pink-500 text-white`;
    } else if (event.type === 'private_party') {
      return `${baseClass} bg-purple-500 text-white`;
    } else {
      // Default color for regular events (blue)
      return `${baseClass} bg-blue-500 text-white`;
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return format(date, "h:mm a");
    } catch (error) {
      console.error("Error formatting time:", error);
      return "";
    }
  };

  const handleEventClick = (event: CalendarEventType) => {
    if (onEventClick) {
      onEventClick(event);
    }
  };

  if (view === "month") {
    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200">
        {days.map((day, i) => (
          <div
            key={i}
            className={`min-h-[100px] bg-white p-1 ${getDayClassName(day)}`}
            onClick={() => onDayClick && onDayClick(day)}
          >
            <div className="font-semibold mb-1">{format(day, "d")}</div>
            <div className="space-y-1 max-h-[80px] overflow-y-auto">
              {getEvents(day).map((event) => (
                <div
                  key={event.id}
                  className={getEventClassName(event)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEventClick(event);
                  }}
                >
                  {isExternalCalendar ? "Booked" : event.title}
                  <div className="text-xs opacity-90">
                    {formatTime(event.start_date)} - {formatTime(event.end_date)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Week or Day view
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return (
    <div className="grid grid-cols-[auto_1fr] h-full overflow-y-auto">
      <div className="border-r border-gray-200 pr-2 text-right space-y-[17px] pt-6">
        {hours.map((hour) => (
          <div key={hour} className="h-14 text-sm text-gray-500">
            {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
          </div>
        ))}
      </div>
      
      <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((day, dayIndex) => (
          <Fragment key={dayIndex}>
            <div className="border-b border-gray-200 py-1 px-2 text-center sticky top-0 bg-white z-10">
              <div>{format(day, "EEE")}</div>
              <div className="font-semibold">{format(day, "d")}</div>
            </div>
            
            <div className="col-start-[inherit] col-end-[inherit] relative border-r border-gray-200">
              {hours.map((hour) => (
                <div 
                  key={hour}
                  className="h-14 border-b border-gray-200 relative"
                  onClick={() => onDayClick && onDayClick(day, hour)}
                >
                  {getEvents(day)
                    .filter(event => {
                      const startHour = new Date(event.start_date).getHours();
                      return startHour === hour;
                    })
                    .map((event) => {
                      const startDate = new Date(event.start_date);
                      const endDate = new Date(event.end_date);
                      const startHour = startDate.getHours();
                      const endHour = endDate.getHours();
                      const height = Math.max((endHour - startHour) * 56, 30); // Minimum height of 25px
                      
                      return (
                        <div
                          key={event.id}
                          className={`${getEventClassName(event)} absolute w-full left-0 overflow-hidden`}
                          style={{ 
                            top: `${(startDate.getMinutes() / 60) * 56}px`,
                            height: `${height}px`,
                            maxHeight: `${height}px`,
                            zIndex: 5
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                        >
                          <div className="font-medium truncate">
                            {isExternalCalendar ? "Booked" : event.title}
                          </div>
                          <div className="text-xs">
                            {formatTime(event.start_date)} - {formatTime(event.end_date)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
};
