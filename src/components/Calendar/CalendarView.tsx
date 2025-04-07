import { Fragment, useState, useEffect } from "react";
import { formatDate, format, parse, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addHours, addMinutes, differenceInMinutes, setMinutes, setHours, isAfter, isBefore, isWithinInterval } from "date-fns";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { motion } from "framer-motion";
import { TimeIndicator } from "./TimeIndicator";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarViewProps {
  selectedDate: Date;
  selectedView: CalendarViewType;
  events: CalendarEventType[];
  onSelectEvent: (event: CalendarEventType) => void;
  onSelectDate: (date: Date) => void;
}

const Day = ({
  day,
  selectedDate,
  events,
  onSelectEvent,
  onSelectDate,
  isCurrentMonth,
}: {
  day: Date;
  selectedDate: Date;
  events: CalendarEventType[];
  onSelectEvent: (event: CalendarEventType) => void;
  onSelectDate: (date: Date) => void;
  isCurrentMonth: boolean;
}) => {
  const dayEvents = events.filter((event) => {
    const eventStart = parse(event.start_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date());
    const eventEnd = parse(event.end_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date());
    return isWithinInterval(day, { start: eventStart, end: eventEnd });
  });

  const isSelected = isSameDay(day, selectedDate);
  const isToday = isSameDay(day, new Date());

  return (
    <div
      className={`relative p-2 border rounded-md h-24 sm:h-32 ${
        !isCurrentMonth ? "text-gray-400 border-gray-300" : "border-gray-200"
      } ${isSelected ? "bg-blue-100" : ""} ${
        isToday ? "bg-green-100" : ""
      } hover:bg-gray-50 cursor-pointer`}
      onClick={() => onSelectDate(day)}
    >
      <div className="font-semibold">
        {format(day, "d")}
      </div>
      {dayEvents.map((event) => (
        <div
          key={event.id}
          className="bg-blue-500 text-white text-sm py-1 px-2 rounded mt-1 truncate"
          onClick={(e) => {
            e.stopPropagation();
            onSelectEvent(event);
          }}
        >
          {event.title}
        </div>
      ))}
    </div>
  );
};

const Week = ({
  weekStart,
  selectedDate,
  events,
  onSelectEvent,
  onSelectDate,
  month,
}: {
  weekStart: Date;
  selectedDate: Date;
  events: CalendarEventType[];
  onSelectEvent: (event: CalendarEventType) => void;
  onSelectDate: (date: Date) => void;
  month: number;
}) => {
  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => (
        <Day
          key={day.toISOString()}
          day={day}
          selectedDate={selectedDate}
          events={events}
          onSelectEvent={onSelectEvent}
          onSelectDate={onSelectDate}
          isCurrentMonth={month === day.getMonth()}
        />
      ))}
    </div>
  );
};

const DayView = ({
  selectedDate,
  events,
  onSelectEvent,
  onSelectDate,
}: {
  selectedDate: Date;
  events: CalendarEventType[];
  onSelectEvent: (event: CalendarEventType) => void;
  onSelectDate: (date: Date) => void;
}) => {
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(intervalId);
  }, []);

  const startOfDay = setHours(setMinutes(selectedDate, 0), 0);
  const endOfDay = setHours(setMinutes(selectedDate, 59), 23);

  const visibleEvents = events.filter((event) => {
    const eventStart = parse(event.start_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date());
    const eventEnd = parse(event.end_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date());
    return isWithinInterval(eventStart, { start: startOfDay, end: endOfDay });
  });

  const slots = [];
  let currentTimeSlot = startOfDay;

  while (currentTimeSlot <= endOfDay) {
    slots.push(currentTimeSlot);
    currentTimeSlot = addMinutes(currentTimeSlot, 60);
  }

  const getEventPosition = (event: CalendarEventType) => {
    const eventStart = parse(event.start_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date());
    const eventEnd = parse(event.end_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date());
    const slotStart = setMinutes(setHours(selectedDate, eventStart.getHours()), eventStart.getMinutes());

    const top = differenceInMinutes(slotStart, startOfDay);
    const height = differenceInMinutes(eventEnd, eventStart);

    return { top, height };
  };

  const isCurrentTimeVisible = isSameDay(selectedDate, new Date());

  return (
    <div className="relative h-[1000px]">
      {isCurrentTimeVisible && <TimeIndicator selectedDate={selectedDate} />}
      {slots.map((slot) => (
        <div
          key={slot.toISOString()}
          className="absolute top-0 left-0 w-full h-[60px] border-b border-gray-200"
          style={{ top: differenceInMinutes(slot, startOfDay) }}
          onClick={() => onSelectDate(slot)}
        >
          <div className="absolute left-2 top-0 text-xs text-gray-500">
            {format(slot, "h:mm a")}
          </div>
        </div>
      ))}
      {visibleEvents.map((event) => {
        const { top, height } = getEventPosition(event);
        return (
          <motion.div
            key={event.id}
            className="absolute bg-blue-500 text-white text-sm p-2 rounded cursor-pointer truncate"
            style={{ top: top, height: height, left: 0, width: "95%" }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEvent(event);
            }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {event.title}
          </motion.div>
        );
      })}
    </div>
  );
};

const WeekView = ({
  selectedDate,
  events,
  onSelectEvent,
  onSelectDate,
}: {
  selectedDate: Date;
  events: CalendarEventType[];
  onSelectEvent: (event: CalendarEventType) => void;
  onSelectDate: (date: Date) => void;
}) => {
  const { t } = useLanguage();
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const end = addDays(start, 6);
  const weekInterval = eachDayOfInterval({ start, end });

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekInterval.map((day) => {
        const dayEvents = events.filter((event) => {
          const eventStart = parse(event.start_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date());
          const eventEnd = parse(event.end_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date());
          return isWithinInterval(day, { start: eventStart, end: eventEnd });
        });

        return (
          <div
            key={day.toISOString()}
            className="relative p-2 border rounded-md h-32 border-gray-200 hover:bg-gray-50 cursor-pointer"
            onClick={() => onSelectDate(day)}
          >
            <div className="font-semibold">
              {format(day, "d")}
            </div>
            <div className="text-sm text-gray-500">
              {t(`date.weekdays.${format(day, "EEEE").toLowerCase()}`)}
            </div>
            {dayEvents.map((event) => (
              <div
                key={event.id}
                className="bg-blue-500 text-white text-sm py-1 px-2 rounded mt-1 truncate"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent(event);
                }}
              >
                {event.title}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate,
  selectedView,
  events,
  onSelectEvent,
  onSelectDate
}) => {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(monthStart);
  const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });

  const weeks: Date[] = [];
  let currentWeekStart = firstWeekStart;

  while (isBefore(currentWeekStart, monthEnd) || isSameMonth(currentWeekStart, monthEnd)) {
    weeks.push(currentWeekStart);
    currentWeekStart = addDays(currentWeekStart, 7);
  }

  return (
    <div className="p-4">
      {selectedView === "month" && (
        <div>
          {weeks.map((weekStart) => (
            <Week
              key={weekStart.toISOString()}
              weekStart={weekStart}
              selectedDate={selectedDate}
              events={events}
              onSelectEvent={onSelectEvent}
              onSelectDate={onSelectDate}
              month={monthStart.getMonth()}
            />
          ))}
        </div>
      )}
      {selectedView === "week" && (
        <WeekView
          selectedDate={selectedDate}
          events={events}
          onSelectEvent={onSelectEvent}
          onSelectDate={onSelectDate}
        />
      )}
      {selectedView === "day" && (
        <DayView
          selectedDate={selectedDate}
          events={events}
          onSelectEvent={onSelectEvent}
          onSelectDate={onSelectDate}
        />
      )}
    </div>
  );
};
