
import { format, isSameDay, isSameMonth, startOfWeek, addDays } from "date-fns";
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
}

export const CalendarGrid = ({
  days,
  events,
  formattedSelectedDate,
  view,
  onDayClick,
  onEventClick,
  isExternalCalendar = false,
}: CalendarGridProps) => {
  // Get the start of the week for proper alignment
  const startDate = startOfWeek(days[0]);
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  // Generate properly aligned weekday headers
  const weekDays = Array.from({ length: 7 }, (_, i) => 
    format(addDays(startDate, i), isMobile ? 'EEEEE' : 'EEE')
  );

  // Convert formattedSelectedDate string back to a Date for comparison
  const selectedDate = new Date(formattedSelectedDate);

  // Get event color based on type and whether it's an external calendar
  const getEventStyles = (event: CalendarEventType) => {
    if (isExternalCalendar) {
      // In external calendar, all events (including regular events) should have a consistent appearance as "Booked"
      return "bg-green-500 text-white";
    } else {
      // In internal calendar, use event type to determine appearance
      if (event.type === "booking_request") {
        return "bg-green-500 text-white"; 
      } else if (event.type === "birthday") {
        return "bg-blue-100 text-blue-700";
      } else {
        return "bg-purple-100 text-purple-700";
      }
    }
  };

  // Get event title based on whether it's an external calendar
  const getEventTitle = (event: CalendarEventType): string => {
    // For external calendar, always display as "Booked"
    if (isExternalCalendar) {
      return "Booked";
    }
    // For internal calendar, display the actual title
    return event.title;
  };

  // For week and day view, we need to render hours
  if (view === 'week' || view === 'day') {
    // Reorder hours to start from 6 AM to match the TimeIndicator component
    const HOURS = [
      ...Array.from({ length: 18 }, (_, i) => i + 6), // 6 AM to 23 PM
      ...Array.from({ length: 6 }, (_, i) => i) // 0 AM to 5 AM
    ];
    
    return (
      <div className="grid grid-cols-1 h-full overflow-y-auto">
        {/* Add weekday headers for week view */}
        {view === 'week' && (
          <div className="grid grid-cols-7 bg-white sticky top-0 z-20 border-b border-gray-200">
            {days.map((day, index) => (
              <div key={`header-${index}`} className="p-1 text-center font-semibold text-xs sm:text-sm">
                <div>{format(day, isMobile ? 'E' : 'EEE')}</div>
                <div>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
        )}
        
        <div className="grid" style={{ 
          gridTemplateRows: `repeat(${HOURS.length}, 6rem)`,
          height: `${HOURS.length * 6}rem`
        }}>
          {HOURS.map((hourIndex, rowIndex) => (
            <div 
              key={hourIndex} 
              className="grid border-b border-gray-200"
              style={{ 
                gridTemplateColumns: view === 'day' ? '1fr' : 'repeat(7, 1fr)',
                height: '6rem'
              }}
            >
              {days.map((day) => (
                <div
                  key={`${day.toISOString()}-${hourIndex}`}
                  className={`border-r border-gray-200 p-1 relative ${
                    !isSameMonth(day, selectedDate) ? "text-gray-400" : ""
                  }`}
                  onClick={() => onDayClick?.(day, hourIndex)}
                >
                  {/* Render events that start in this hour */}
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
                      
                      // On mobile, we'll only show up to 2 events and then indicate how many more
                      if (isMobile && idx > 1) {
                        if (idx === 2) {
                          return (
                            <div 
                              key={`more-${event.id}`} 
                              className="text-[0.65rem] text-gray-600 font-medium absolute bottom-0 left-1 right-1"
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
                          {/* Enhanced mobile view with more content from the event */}
                          {isMobile ? (
                            <div className="flex flex-col h-full text-[0.65rem]">
                              {/* Title with icon - smaller to save space */}
                              <div className="flex items-center mb-0.5">
                                <CalendarIcon className="h-2 w-2 mr-0.5 shrink-0" />
                                <span className="truncate font-medium text-[0.7rem]">
                                  {getEventTitle(event)}
                                </span>
                              </div>
                              
                              {/* Time with compact display */}
                              <div className="flex justify-between text-[0.6rem]">
                                <span>{format(startTime, 'HH:mm')}</span>
                                <span>{format(endTime, 'HH:mm')}</span>
                              </div>
                              
                              {/* Requester name with high priority */}
                              {event.requester_name && (
                                <div className="truncate mt-0.5 font-medium">
                                  {event.requester_name}
                                </div>
                              )}
                              
                              {/* Phone number if available */}
                              {event.requester_phone && (
                                <div className="truncate text-[0.6rem]">
                                  📱 {event.requester_phone}
                                </div>
                              )}
                              
                              {/* Description with character limit */}
                              {event.description && (
                                <div className="truncate text-[0.6rem] mt-0.5 italic">
                                  {event.description.slice(0, 25)}
                                  {event.description.length > 25 ? '...' : ''}
                                </div>
                              )}
                              
                              {/* Additional info like payment status if room */}
                              {event.payment_status && (
                                <div className="truncate text-[0.6rem] mt-auto">
                                  💰 {event.payment_status}
                                </div>
                              )}
                            </div>
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
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Month view (default)
  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {weekDays.map((day) => (
        <div key={day} className="bg-white p-2 sm:p-4 text-center font-semibold text-xs sm:text-sm">
          {day}
        </div>
      ))}
      {days.map((day) => {
        // Get events for this day
        const dayEvents = events.filter((event) => isSameDay(new Date(event.start_date), day));
        
        return (
          <div
            key={day.toISOString()}
            className={`bg-white p-1 sm:p-4 min-h-[90px] sm:min-h-[120px] cursor-pointer hover:bg-gray-50 ${
              !isSameMonth(day, selectedDate) ? "text-gray-400" : ""
            }`}
            onClick={() => onDayClick?.(day)}
          >
            <div className="font-medium text-xs sm:text-sm">{format(day, "d")}</div>
            <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
              {dayEvents.length > 0 ? (
                isMobile ? (
                  // Mobile optimized view - more compact, shows more info
                  <>
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`text-[0.65rem] sm:text-sm p-0.5 pl-1 sm:p-1.5 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm`}
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
                      <div className="text-[0.65rem] text-gray-600 font-medium pl-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </>
                ) : (
                  // Desktop view - standard
                  dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`text-sm p-1.5 rounded flex items-center ${getEventStyles(event)} cursor-pointer truncate shadow-sm`}
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
