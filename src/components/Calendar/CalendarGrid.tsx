
import { format, isSameDay, isSameMonth, startOfWeek, endOfWeek, addDays, endOfMonth, isBefore, isAfter } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface CalendarGridProps {
  days: Date[];
  events: CalendarEventType[];
  formattedSelectedDate: string;
  view: string;
  onDayClick?: (date: Date, hour?: number) => void;
  onEventClick?: (event: CalendarEventType) => void;
  isExternalCalendar?: boolean;
  theme?: string;
}

export const CalendarGrid = ({
  days,
  events,
  formattedSelectedDate,
  view,
  onDayClick,
  onEventClick,
  isExternalCalendar = false,
  theme,
}: CalendarGridProps) => {
  const startDate = startOfWeek(days[0]);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isDarkTheme = theme === "dark";
  
  const weekDays = Array.from({ length: 7 }, (_, i) => 
    format(addDays(startDate, i), isMobile ? 'EEEEE' : 'EEE')
  );

  const selectedDate = new Date(formattedSelectedDate);
  
  const selectedMonthEnd = endOfMonth(selectedDate);
  const lastDayOfGrid = endOfWeek(selectedMonthEnd);

  const getEventStyles = (event: CalendarEventType) => {
    if (isExternalCalendar) {
      return isDarkTheme ? "bg-emerald-500 text-white" : "bg-green-500 text-white";
    } else {
      if (event.type === "booking_request") {
        return isDarkTheme ? "bg-emerald-500 text-white" : "bg-green-500 text-white"; 
      } else if (event.type === "birthday") {
        return isDarkTheme ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700";
      } else {
        return isDarkTheme ? "bg-purple-500 text-white" : "bg-purple-100 text-purple-700";
      }
    }
  };

  const getEventTitle = (event: CalendarEventType): string => {
    if (isExternalCalendar) {
      return "Booked";
    }
    return event.title;
  };

  if (view === 'week' || view === 'day') {
    const HOURS = [
      ...Array.from({ length: 18 }, (_, i) => i + 6),
      ...Array.from({ length: 6 }, (_, i) => i)
    ];
    
    return (
      <div className="grid grid-cols-1 h-full overflow-y-auto">
        {view === 'week' && (
          <div className={`grid grid-cols-7 ${isDarkTheme ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white'} sticky top-0 z-20 border-b ${isDarkTheme ? 'border-gray-600' : 'border-gray-200'} h-8 ${isMobile ? 'text-[0.7rem]' : ''}`}>
            {days.map((day, index) => (
              <div key={`header-${index}`} className={`p-1 text-center font-semibold ${isMobile ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                {format(day, isMobile ? 'E d' : 'EEE d')}
              </div>
            ))}
          </div>
        )}
        
        {view === 'day' && (
          <div className={`${isDarkTheme ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white'} sticky top-0 z-20 border-b ${isDarkTheme ? 'border-gray-600' : 'border-gray-200'} h-8`}>
            <div className="p-1 text-center font-semibold text-xs sm:text-sm">
              {format(days[0], isMobile ? 'E d' : 'EEEE, MMMM d')}
            </div>
          </div>
        )}
        
        <div className="grid" style={{ 
          gridTemplateRows: `repeat(${HOURS.length}, 6rem)`,
          height: `${HOURS.length * 6}rem`
        }}>
          {HOURS.map((hourIndex, rowIndex) => (
            <div 
              key={hourIndex} 
              className={`grid ${isDarkTheme ? 'border-gray-600' : 'border-gray-200'} border-b`}
              style={{ 
                gridTemplateColumns: view === 'day' ? '1fr' : 'repeat(7, 1fr)',
                height: '6rem'
              }}
            >
              {view === 'day' ? (
                <div
                  key={`${days[0].toISOString()}-${hourIndex}`}
                  className={`${isDarkTheme ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} border-r p-1 relative transition-colors cursor-pointer`}
                  onClick={() => onDayClick?.(days[0], hourIndex)}
                >
                  {events
                    .filter((event) => {
                      const eventDate = new Date(event.start_date);
                      return (
                        isSameDay(eventDate, days[0]) && 
                        eventDate.getHours() === hourIndex
                      );
                    })
                    .map((event, idx) => {
                      const startTime = new Date(event.start_date);
                      const endTime = new Date(event.end_date);
                      const durationHours = Math.max(
                        1, 
                        Math.ceil(
                          (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
                        )
                      );
                      
                      if (isMobile && idx > 1) {
                        if (idx === 2) {
                          return (
                            <div 
                              key={`more-${event.id}`} 
                              className={`text-[0.65rem] ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'} font-medium absolute bottom-0 left-1 right-1`}
                            >
                              +{events.filter(e => {
                                const eDate = new Date(e.start_date);
                                return isSameDay(eDate, days[0]) && eDate.getHours() === hourIndex;
                              }).length - 2} more
                            </div>
                          );
                        }
                        return null;
                      }
                      
                      return (
                        <div
                          key={event.id}
                          className={`${getEventStyles(event)} rounded cursor-pointer absolute top-1 left-1 right-1 overflow-hidden ${isMobile ? 'p-0.5' : 'p-1 sm:p-2'}`}
                          style={{ 
                            height: `${Math.min(durationHours * 6 - 0.5, 5.5)}rem`,
                            zIndex: 10
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                        >
                          {isMobile ? (
                            <>
                              <div className="flex items-center mb-0.5">
                                <CalendarIcon className="h-2 w-2 mr-0.5 shrink-0" />
                                <span className="truncate font-medium text-[0.7rem]">
                                  {getEventTitle(event)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[0.65rem]">
                                <span className="truncate">
                                  {format(startTime, 'HH:mm')}
                                </span>
                                <span className="truncate">
                                  {format(endTime, 'HH:mm')}
                                </span>
                              </div>
                              {event.requester_name && (
                                <div className="truncate text-[0.65rem] mt-0.5">
                                  {event.requester_name}
                                </div>
                              )}
                              {!event.requester_name && event.description && (
                                <div className="truncate text-[0.65rem] mt-0.5">
                                  {event.description.slice(0, 20)}
                                  {event.description.length > 20 ? '...' : ''}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="flex items-center">
                                <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
                                <span className="truncate font-medium text-sm">
                                  {getEventTitle(event)}
                                </span>
                              </div>
                              <div className="truncate text-xs">
                                {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                days.map((day) => (
                  <div
                    key={`${day.toISOString()}-${hourIndex}`}
                    className={`${isDarkTheme ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} border-r p-1 relative transition-colors cursor-pointer ${
                      !isSameMonth(day, selectedDate) ? isDarkTheme ? "text-gray-500" : "text-gray-400" : ""
                    }`}
                    onClick={() => onDayClick?.(day, hourIndex)}
                  >
                    {events
                      .filter((event) => {
                        const eventDate = new Date(event.start_date);
                        return (
                          isSameDay(eventDate, day) && 
                          eventDate.getHours() === hourIndex
                        );
                      })
                      .map((event, idx) => {
                        const startTime = new Date(event.start_date);
                        const endTime = new Date(event.end_date);
                        const durationHours = Math.max(
                          1, 
                          Math.ceil(
                            (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
                          )
                        );
                        
                        if (isMobile && idx > 1) {
                          if (idx === 2) {
                            return (
                              <div 
                                key={`more-${event.id}`} 
                                className={`text-[0.65rem] ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'} font-medium absolute bottom-0 left-1 right-1`}
                              >
                                +{events.filter(e => {
                                  const eDate = new Date(e.start_date);
                                  return isSameDay(eDate, day) && eDate.getHours() === hourIndex;
                                }).length - 2} more
                              </div>
                            );
                          }
                          return null;
                        }
                        
                        return (
                          <div
                            key={event.id}
                            className={`${getEventStyles(event)} rounded cursor-pointer absolute top-1 left-1 right-1 overflow-hidden ${isMobile ? 'p-0.5' : 'p-1 sm:p-2'}`}
                            style={{ 
                              height: `${Math.min(durationHours * 6 - 0.5, 5.5)}rem`,
                              zIndex: 10
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                          >
                            {isMobile ? (
                              <>
                                <div className="flex items-center mb-0.5">
                                  <CalendarIcon className="h-2 w-2 mr-0.5 shrink-0" />
                                  <span className="truncate font-medium text-[0.7rem]">
                                    {getEventTitle(event)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[0.65rem]">
                                  <span className="truncate">
                                    {format(startTime, 'HH:mm')}
                                  </span>
                                  <span className="truncate">
                                    {format(endTime, 'HH:mm')}
                                  </span>
                                </div>
                                {event.requester_name && (
                                  <div className="truncate text-[0.65rem] mt-0.5">
                                    {event.requester_name}
                                  </div>
                                )}
                                {!event.requester_name && event.description && (
                                  <div className="truncate text-[0.65rem] mt-0.5">
                                    {event.description.slice(0, 20)}
                                    {event.description.length > 20 ? '...' : ''}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex items-center">
                                  <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
                                  <span className="truncate font-medium text-sm">
                                    {getEventTitle(event)}
                                  </span>
                                </div>
                                <div className="truncate text-xs">
                                  {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'month') {
    return (
      <div className={`grid grid-cols-7 gap-px ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-200'} rounded-lg overflow-hidden`}>
        {weekDays.map((day) => (
          <div key={day} className={`${isDarkTheme ? 'bg-gray-800 text-gray-100 border-gray-600' : 'bg-white'} p-2 sm:p-4 text-center font-semibold text-xs sm:text-sm border-b`}>
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dayEvents = events.filter((event) => isSameDay(new Date(event.start_date), day));
          const isOtherMonth = !isSameMonth(day, selectedDate);
          
          return (
            <div
              key={day.toISOString()}
              className={`${
                isDarkTheme 
                  ? (isOtherMonth 
                      ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-100' 
                      : 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-400')
                  : (isOtherMonth 
                      ? 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-400' 
                      : 'bg-white hover:bg-gray-50 text-gray-900')
              } p-1 sm:p-4 min-h-[90px] sm:min-h-[120px] cursor-pointer border-r border-b`}
              onClick={() => onDayClick?.(day)}
            >
              <div className={`font-medium text-xs sm:text-sm ${isDarkTheme ? 'text-gray-100' : ''}`}>
                {format(day, "d")}
              </div>
              <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
                {dayEvents.length > 0 ? (
                  isMobile ? (
                    <>
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`text-[0.65rem] sm:text-sm p-0.5 pl-1 sm:p-1.5 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm ${
                            isOtherMonth ? 'opacity-60' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                        >
                          <CalendarIcon className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1.5 shrink-0" />
                          <span className="truncate font-medium">
                            {getEventTitle(event)}
                          </span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className={`text-[0.65rem] ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'} font-medium pl-1 ${
                          isOtherMonth ? 'opacity-60' : ''
                        }`}>
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </>
                  ) : (
                    dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`text-sm p-1.5 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm ${
                          isOtherMonth ? 'opacity-60' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      >
                        <CalendarIcon className="h-3 w-3 mr-1.5 shrink-0" />
                        <span className="truncate font-medium">
                          {getEventTitle(event)}
                        </span>
                      </div>
                    ))
                  )
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-7 gap-px ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-200'} rounded-lg overflow-hidden`}>
      {weekDays.map((day) => (
        <div key={day} className={`${isDarkTheme ? 'bg-gray-800 text-gray-100 border-gray-600' : 'bg-white'} p-2 sm:p-4 text-center font-semibold text-xs sm:text-sm border-b`}>
          {day}
        </div>
      ))}
      {days.map((day) => {
        const dayEvents = events.filter((event) => isSameDay(new Date(event.start_date), day));
        const isOtherMonth = !isSameMonth(day, selectedDate);
        
        return (
          <div
            key={day.toISOString()}
            className={`${
              isDarkTheme 
                ? 'bg-gray-800 hover:bg-gray-700 border-gray-600' 
                : 'bg-white hover:bg-gray-50'
            } p-1 sm:p-4 min-h-[90px] sm:min-h-[120px] cursor-pointer ${
              isOtherMonth ? isDarkTheme ? "text-gray-600" : "text-gray-400" : ""
            } border-r border-b`}
            onClick={() => onDayClick?.(day)}
          >
            <div className={`font-medium text-xs sm:text-sm ${isDarkTheme ? 'text-gray-100' : ''}`}>
              {format(day, "d")}
            </div>
            <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
              {dayEvents.length > 0 ? (
                isMobile ? (
                  <>
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`text-[0.65rem] sm:text-sm p-0.5 pl-1 sm:p-1.5 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm ${
                          isOtherMonth ? 'opacity-60' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      >
                        <CalendarIcon className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1.5 shrink-0" />
                        <span className="truncate font-medium">
                          {getEventTitle(event)}
                        </span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className={`text-[0.65rem] ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'} font-medium pl-1 ${
                        isOtherMonth ? 'opacity-60' : ''
                      }`}>
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </>
                ) : (
                  dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`text-sm p-1.5 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm ${
                        isOtherMonth ? 'opacity-60' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                    >
                      <CalendarIcon className="h-3 w-3 mr-1.5 shrink-0" />
                      <span className="truncate font-medium">
                        {getEventTitle(event)}
                      </span>
                    </div>
                  ))
                )
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
