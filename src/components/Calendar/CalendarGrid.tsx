import { format, isSameDay, isSameMonth, startOfWeek, endOfWeek, addDays, endOfMonth, isBefore, isAfter, isToday } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { Calendar as CalendarIcon, Ban } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useLocalizedDate } from "@/hooks/useLocalizedDate";
import { WorkingHoursConfig, isWorkingDay, isWithinWorkingHours } from "@/types/workingHours";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarGridProps {
  days: Date[];
  events: CalendarEventType[];
  formattedSelectedDate: string;
  view: string;
  onDayClick?: (date: Date, hour?: number) => void;
  onEventClick?: (event: CalendarEventType) => void;
  isExternalCalendar?: boolean;
  theme?: string;
  workingHours?: WorkingHoursConfig | null;
}

const getBookingHours = (event: CalendarEventType) => {
  const start = new Date(event.start_date);
  const end = new Date(event.end_date);
  const startHour = start.getHours();
  const startMinute = start.getMinutes();
  const endHour = end.getHours();
  const endMinute = end.getMinutes();
  return `${startHour}:${startMinute.toString().padStart(2, "0")}\u2013${endHour}:${endMinute.toString().padStart(2, "0")}`;
};

export const CalendarGrid = ({
  days,
  events,
  formattedSelectedDate,
  view,
  onDayClick,
  onEventClick,
  isExternalCalendar = false,
  theme,
  workingHours,
}: CalendarGridProps) => {
  const startDate = startOfWeek(days[0]);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isDarkTheme = theme === "dark";
  const { getWeekdayName, formatDate } = useLocalizedDate();
  const { t } = useLanguage();
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(startDate, i);
    // Mobile month view: 3-letter abbreviations, Desktop: 3-letter abbreviations
    return isMobile ? getWeekdayName(dayDate, true, false, false) : getWeekdayName(dayDate, true, false, false);
  });

  const selectedDate = new Date(formattedSelectedDate);
  
  // Helper to check if a day is a non-working day (for external calendar)
  const isNonWorkingDay = (date: Date): boolean => {
    if (!isExternalCalendar || !workingHours || !workingHours.enabled) {
      return false;
    }
    return !isWorkingDay(date, workingHours);
  };
  
  const selectedMonthEnd = endOfMonth(selectedDate);
  const lastDayOfGrid = endOfWeek(selectedMonthEnd);

  // Modern event styles - solid, more visible cards with sharp text
  const getEventStyles = (event: CalendarEventType) => {
    if (isExternalCalendar) {
      return isDarkTheme 
        ? "bg-emerald-600 text-white border-l-4 border-emerald-400 shadow-lg shadow-emerald-500/20 font-medium" 
        : "bg-emerald-600 text-white border-l-4 border-emerald-700 shadow-md shadow-emerald-500/25 font-medium";
    } else {
      if (event.type === "booking_request") {
        return isDarkTheme 
          ? "bg-emerald-600 text-white border-l-4 border-emerald-400 shadow-lg shadow-emerald-500/20 font-medium" 
          : "bg-emerald-600 text-white border-l-4 border-emerald-700 shadow-md shadow-emerald-500/25 font-medium";
      } else if (event.type === "birthday") {
        return isDarkTheme 
          ? "bg-blue-600 text-white border-l-4 border-blue-400 shadow-lg shadow-blue-500/20 font-medium" 
          : "bg-blue-600 text-white border-l-4 border-blue-700 shadow-md shadow-blue-500/25 font-medium";
      } else {
        return isDarkTheme 
          ? "bg-primary/80 text-white border-l-4 border-primary shadow-lg shadow-primary/20 font-medium" 
          : "bg-primary text-primary-foreground border-l-4 border-primary/80 shadow-md shadow-primary/25 font-medium";
      }
    }
  };

  const renderEventContent = (event: CalendarEventType, includeIcon = false) => {
    const bookingHours = getBookingHours(event);

    // For external calendar - always show "Booked" instead of event title for privacy
    if (isExternalCalendar) {
      // For mobile view in external calendar
      if (isMobile) {
        return (
          <div className="w-full flex flex-col items-center text-center justify-center space-y-0.5">
            {/* Don't include icon here, it will be added at the container level */}
            <span className="block font-medium text-[0.7rem] leading-tight truncate max-w-[90%]">
              Booked
            </span>
            <span className="block text-[0.65rem] opacity-80 leading-tight truncate max-w-[90%]">
              {bookingHours}
            </span>
          </div>
        );
      }
      
      // For desktop view in external calendar
      return (
        <div className={`${includeIcon ? 'flex-1' : 'w-full'} min-w-0`}>
          <span className="block font-medium text-xs sm:text-sm truncate">
            Booked
          </span>
          <span className="block text-xs sm:text-sm opacity-80 truncate">
            {bookingHours}
          </span>
        </div>
      );
    }
    
    // For internal (dashboard) calendar - use event_name if available, otherwise fall back to person name
    // Add debug logging to see what we're getting
    console.log("Calendar rendering event:", event.id, "event_name:", event.event_name, "title:", event.title, "user_surname:", event.user_surname);
    
    const displayTitle = event.event_name || event.requester_name || event.user_surname || event.title || "";
    console.log("Calendar display title chosen:", displayTitle);
    
    // Display vertically on mobile for internal calendar with improved spacing
    if (isMobile) {
      return (
        <div className="w-full flex flex-col items-center text-center justify-center space-y-0.5">
          {/* Don't include icon here, it will be added at the container level */}
          <span className="block font-medium text-[0.7rem] leading-tight truncate max-w-[90%]">
            {displayTitle}
          </span>
          <span className="block text-[0.65rem] opacity-80 leading-tight truncate max-w-[90%]">
            {bookingHours}
          </span>
        </div>
      );
    }
    
    // Desktop layout
    return (
      <div className={`${includeIcon ? 'flex-1' : 'w-full'} min-w-0`}>
        <span className="block font-medium text-xs sm:text-sm truncate">
          {displayTitle}
        </span>
        <span className="block text-xs sm:text-sm opacity-80 truncate">
          {bookingHours}
        </span>
      </div>
    );
  };

  if (view === 'week' || view === 'day') {
    // Reorder hours to start from 9 AM
    const HOURS = [
      ...Array.from({ length: 15 }, (_, i) => i + 9), // 9 AM to 23 (11 PM)
      ...Array.from({ length: 9 }, (_, i) => i) // 0 AM to 8 AM
    ];
    
    // Time column width for alignment
    const timeColumnWidth = isMobile ? '2.5rem' : '3.5rem';
    
    return (
      <div className={`grid grid-cols-1 h-full overflow-y-auto ${isDarkTheme ? 'bg-background/30 border border-border/25' : 'border border-border/35 bg-card/15'} rounded-xl`}>
        {view === 'week' && (
          <div 
            className={`grid ${isDarkTheme ? 'bg-muted/10 border-border/25' : 'bg-muted/35 border-border/30'} sticky top-0 z-20 border-b ${isMobile ? 'h-12' : 'h-10'} ${isMobile ? 'text-[0.7rem]' : ''}`}
            style={{ gridTemplateColumns: `${timeColumnWidth} repeat(7, 1fr)` }}
          >
            {/* Empty time column placeholder for alignment */}
            <div className={`${isDarkTheme ? 'border-border/25' : 'border-border/30'} border-r`}></div>
            {days.map((day, index) => {
              const isTodayDate = isToday(day);
              return (
                <div 
                  key={`header-${index}`} 
                  className={`p-1 text-center font-semibold ${isMobile ? 'text-xs flex flex-col items-center justify-center' : 'text-xs sm:text-sm p-1.5'} tracking-wide ${
                    isTodayDate 
                      ? 'text-primary' 
                      : isDarkTheme ? 'text-foreground/90' : 'text-foreground/80'
                  } ${index < 6 ? 'border-r border-border/20' : ''}`}
                >
                  {isMobile ? (
                    <>
                      <span>{getWeekdayName(day, false, false, true)}</span>
                      <span>{day.getDate()}</span>
                    </>
                  ) : (
                    `${getWeekdayName(day, false, false, true)} ${day.getDate()}`
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {view === 'day' && (
          <div 
            className={`grid ${isDarkTheme ? 'bg-muted/10 border-border/25' : 'bg-muted/35 border-border/30'} sticky top-0 z-20 border-b h-10`}
            style={{ gridTemplateColumns: `${timeColumnWidth} 1fr` }}
          >
            {/* Empty time column placeholder for alignment */}
            <div className={`${isDarkTheme ? 'border-border/25' : 'border-border/30'} border-r`}></div>
            <div className={`p-1.5 text-center font-semibold text-xs sm:text-sm tracking-wide ${isToday(days[0]) ? 'text-primary' : isDarkTheme ? 'text-foreground/90' : 'text-foreground/80'}`}>
              {/* Full date format for both mobile and desktop day view */}
              {formatDate(days[0], "full")}
            </div>
          </div>
        )}
        
        <div className={`grid ${isDarkTheme ? 'bg-transparent' : 'bg-card/30'} rounded-b-xl overflow-hidden`} style={{ 
          gridTemplateRows: `repeat(${HOURS.length}, 3rem)`,
          height: `${HOURS.length * 3}rem`
        }}>
          {HOURS.map((hourIndex, rowIndex) => (
            <div 
              key={hourIndex} 
              className={`grid border-b ${isDarkTheme ? 'border-border/25' : 'border-border/30'}`}
              style={{ 
                gridTemplateColumns: view === 'day' ? `${timeColumnWidth} 1fr` : `${timeColumnWidth} repeat(7, 1fr)`,
                height: '3rem'
              }}
            >
              {/* Time label column */}
              <div className={`flex items-center justify-center text-[0.65rem] sm:text-xs ${isDarkTheme ? 'text-muted-foreground/70 border-border/25' : 'text-muted-foreground border-border/30'} border-r font-medium`}>
                {hourIndex === 0 ? '12AM' : hourIndex < 12 ? `${hourIndex}AM` : hourIndex === 12 ? '12PM' : `${hourIndex - 12}PM`}
              </div>
              {view === 'day' ? (
                <div
                  key={`${days[0].toISOString()}-${hourIndex}`}
                  className={`${isDarkTheme ? 'hover:bg-primary/8 hover:border-l-2 hover:border-l-primary/40' : 'hover:bg-primary/5 hover:border-l-2 hover:border-l-primary/30'} p-1 relative transition-all duration-200 cursor-pointer`}
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
                              className={`text-[0.65rem] ${isDarkTheme ? 'text-muted-foreground/60' : 'text-muted-foreground'} font-medium absolute bottom-0 left-1 right-1`}
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
                          className={`${getEventStyles(event)} rounded-lg cursor-pointer absolute top-0.5 left-0.5 right-0.5 overflow-hidden p-0.5 sm:p-1 transition-transform duration-200 hover:scale-[1.02]`}
                          style={{ 
                            height: `${Math.min(durationHours * 3 - 0.25, 2.75)}rem`,
                            zIndex: 10
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                        >
                          {isMobile ? (
                            <div className="flex flex-col items-center">
                              <CalendarIcon className="h-4 w-4 mb-0.5 opacity-80" />
                              {renderEventContent(event)}
                            </div>
                          ) : (
                            <div className="flex items-center mb-0.5">
                              <CalendarIcon className="h-4 w-4 mr-1.5 shrink-0 opacity-80" />
                              {renderEventContent(event, true)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                days.map((day, colIndex) => (
                  <div
                    key={`${day.toISOString()}-${hourIndex}`}
                    className={`${isDarkTheme ? 'hover:bg-primary/8 hover:border-l-2 hover:border-l-primary/40' : 'hover:bg-primary/5 hover:border-l-2 hover:border-l-primary/30'} ${colIndex < days.length - 1 ? 'border-r border-border/20' : ''} p-1 relative transition-all duration-200 cursor-pointer ${
                      !isSameMonth(day, selectedDate) ? 'opacity-40' : ''
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
                                className={`text-[0.65rem] ${isDarkTheme ? 'text-muted-foreground/60' : 'text-muted-foreground'} font-medium absolute bottom-0 left-1 right-1`}
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
                            className={`${getEventStyles(event)} rounded-lg cursor-pointer absolute top-0.5 left-0.5 right-0.5 overflow-hidden p-0.5 sm:p-1 transition-transform duration-200 hover:scale-[1.02]`}
                            style={{ 
                              height: `${Math.min(durationHours * 3 - 0.25, 2.75)}rem`,
                              zIndex: 10
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                          >
                            {isMobile ? (
                              <div className="flex flex-col items-center">
                                <CalendarIcon className="h-4 w-4 mb-0.5 opacity-80" />
                                {renderEventContent(event)}
                              </div>
                            ) : (
                              <div className="flex items-center mb-0.5">
                                <CalendarIcon className="h-4 w-4 mr-1.5 shrink-0 opacity-80" />
                                {renderEventContent(event, true)}
                              </div>
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
      <div className={`grid grid-cols-7 ${isDarkTheme ? 'bg-background/30 border border-border/25' : 'border border-border/35 bg-card/15'} rounded-xl overflow-hidden`}>
        {weekDays.map((day, idx) => (
          <div 
            key={day} 
            className={`${isDarkTheme ? 'bg-muted/10 text-foreground/90 border-b border-r border-border/25' : 'bg-muted/25 text-foreground/80 border-b border-r border-border/30'} ${idx === 6 ? 'border-r-0' : ''} py-2.5 sm:py-3 text-center font-semibold text-[0.65rem] sm:text-xs uppercase tracking-wider`}
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dayEvents = events.filter((event) => isSameDay(new Date(event.start_date), day));
          const isOtherMonth = !isSameMonth(day, selectedDate);
          const eventsToShow = dayEvents.slice(0, 2);
          const hiddenEventsCount = Math.max(0, dayEvents.length - 2);
          const nonWorkingDay = isNonWorkingDay(day);
          const isTodayDate = isToday(day);
          
          const dayIndex = days.indexOf(day);
          const isLastInRow = (dayIndex + 1) % 7 === 0;
          
          return (
            <div
              key={day.toISOString()}
              className={`${
                nonWorkingDay
                  ? (isDarkTheme 
                      ? 'bg-muted/5 cursor-not-allowed' 
                      : 'bg-muted/20 cursor-not-allowed')
                  : isDarkTheme 
                    ? (isOtherMonth 
                        ? 'hover:bg-primary/10 hover:shadow-inner' 
                        : 'hover:bg-primary/15 hover:shadow-inner')
                    : (isOtherMonth 
                        ? 'bg-card/40 hover:bg-primary/15 hover:shadow-inner' 
                        : 'hover:bg-primary/20 hover:shadow-inner')
              } ${isDarkTheme ? 'border-b border-r border-border/25' : 'border-b border-r border-border/30'} ${isLastInRow ? 'border-r-0' : ''} p-1.5 sm:p-2 flex flex-col min-h-[140px] sm:min-h-[160px] ${nonWorkingDay ? 'cursor-not-allowed' : 'cursor-pointer'} transition-all duration-200 relative`}
              style={{ height: '160px' }}
              onClick={() => !nonWorkingDay && onDayClick?.(day)}
            >
              {/* Day number with modern styling */}
              <div className={`font-semibold text-xs sm:text-sm mb-1 ${
                isTodayDate 
                  ? 'w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md' 
                  : nonWorkingDay 
                    ? (isDarkTheme ? 'text-muted-foreground/40' : 'text-muted-foreground/50') 
                    : isOtherMonth 
                      ? 'text-muted-foreground/50' 
                      : 'text-foreground'
              }`}>
                {format(day, "d")}
              </div>
              {nonWorkingDay ? (
                <div className="flex flex-col flex-1 min-h-0 justify-center items-center">
                  <Ban className={`h-5 w-5 ${isDarkTheme ? 'text-muted-foreground/30' : 'text-muted-foreground/40'}`} />
                  <span className={`text-[0.65rem] sm:text-xs mt-1 ${isDarkTheme ? 'text-muted-foreground/40' : 'text-muted-foreground/50'}`}>
                    {t("business.closed")}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0 justify-start gap-1">
                  {dayEvents.length > 0 ? (
                    <>
                      <div className="flex flex-col flex-1 min-h-0 gap-1">
                        {eventsToShow.map((event) => (
                          <div
                            key={event.id}
                            className={`flex-1 min-h-0 flex items-center overflow-hidden text-[0.7rem] sm:text-[0.8rem] p-1 sm:p-1.5 rounded-lg ${getEventStyles(event)} cursor-pointer truncate transition-transform duration-200 hover:scale-[1.02] ${isOtherMonth ? 'opacity-50' : ''}`}
                            style={{ maxHeight: "calc(50% - 0.25rem)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                          >
                            {isMobile ? (
                              <div className="flex flex-col items-center w-full">
                                <CalendarIcon className="h-3.5 w-3.5 mb-0.5 opacity-80" />
                                {renderEventContent(event)}
                              </div>
                            ) : (
                              <div className="flex w-full items-center">
                                <CalendarIcon className="h-3.5 w-3.5 mr-1 shrink-0 opacity-80" />
                                {renderEventContent(event, true)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {hiddenEventsCount > 0 && (
                        <div className={`text-[0.65rem] sm:text-xs ${isDarkTheme ? 'text-muted-foreground/60' : 'text-muted-foreground'} font-medium bg-muted/50 rounded px-1.5 py-0.5 w-fit ${isOtherMonth ? 'opacity-50' : ''}`}>
                          +{hiddenEventsCount} more
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-7 ${isDarkTheme ? 'border-2 border-border/70 bg-background/50' : 'border border-border/50 bg-card/30'} rounded-2xl overflow-hidden shadow-xl`}>
      {weekDays.map((day, idx) => (
        <div 
          key={day} 
          className={`${isDarkTheme ? 'bg-muted/50 text-foreground border-b-2 border-r border-border/60' : 'bg-muted/70 text-foreground/90 border-b border-r border-border/40'} ${idx === 6 ? 'border-r-0' : ''} py-3 sm:py-3.5 text-center font-bold text-[0.7rem] sm:text-xs uppercase tracking-widest`}
        >
          {day}
        </div>
      ))}
      {days.map((day, dayIndex) => {
        const dayEvents = events.filter((event) => isSameDay(new Date(event.start_date), day));
        const isOtherMonth = !isSameMonth(day, selectedDate);
        const isTodayDate = isToday(day);
        const isLastInRow = (dayIndex + 1) % 7 === 0;
        
        return (
          <div
            key={day.toISOString()}
            className={`${
              isDarkTheme 
                ? (isOtherMonth ? 'bg-background/40 hover:bg-primary/15 hover:border-primary/30' : 'bg-background/70 hover:bg-primary/20 hover:border-primary/40')
                : (isOtherMonth ? 'bg-card/60 hover:bg-primary/10' : 'bg-card hover:bg-primary/15')
            } ${isDarkTheme ? 'border-b border-r border-border/60' : 'border-b border-r border-border/40'} ${isLastInRow ? 'border-r-0' : ''} p-1.5 sm:p-3 min-h-[90px] sm:min-h-[120px] cursor-pointer transition-all duration-200`}
            onClick={() => onDayClick?.(day)}
          >
            <div className={`font-semibold text-xs sm:text-sm mb-1 ${
              isTodayDate 
                ? 'w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md' 
                : isOtherMonth 
                  ? 'text-muted-foreground/50' 
                  : 'text-foreground'
            }`}>
              {format(day, "d")}
            </div>
            <div className="mt-1 sm:mt-2 space-y-1">
              {dayEvents.length > 0 ? (
                isMobile ? (
                  <>
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`text-[0.65rem] sm:text-sm p-1 sm:p-1.5 rounded-lg ${getEventStyles(event)} cursor-pointer truncate transition-transform duration-200 hover:scale-[1.02] ${
                          isOtherMonth ? 'opacity-50' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <CalendarIcon className="h-3.5 w-3.5 mb-0.5 opacity-80" />
                          {renderEventContent(event)}
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className={`text-[0.65rem] ${isDarkTheme ? 'text-muted-foreground/60' : 'text-muted-foreground'} font-medium bg-muted/50 rounded px-1.5 py-0.5 w-fit ${
                        isOtherMonth ? 'opacity-50' : ''
                      }`}>
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </>
                ) : (
                  dayEvents.slice(0, 3).map((event, idx) => {
                    if (idx === 2 && dayEvents.length > 3) {
                      return (
                        <div 
                          key={event.id}
                          className={`text-[0.7rem] ${isDarkTheme ? 'text-muted-foreground/60' : 'text-muted-foreground'} font-medium bg-muted/50 rounded px-1.5 py-0.5 w-fit ${isOtherMonth ? 'opacity-50' : ''}`}
                        >
                          +{dayEvents.length - 2} more
                        </div>
                      );
                    }
                    return (
                      <div
                        key={event.id}
                        className={`text-sm p-1.5 rounded-lg flex items-center gap-1.5 ${getEventStyles(event)} cursor-pointer truncate transition-transform duration-200 hover:scale-[1.02] ${
                          isOtherMonth ? 'opacity-50' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      >
                        <CalendarIcon className="h-3.5 w-3.5 opacity-80" />
                        {renderEventContent(event, true)}
                      </div>
                    );
                  })
                )
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
