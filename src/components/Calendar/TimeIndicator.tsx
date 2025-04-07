
import { useEffect, useState } from "react";
import { CalendarViewType } from "@/lib/types/calendar";

interface TimeIndicatorProps {
  view: CalendarViewType;
  selectedDate: Date;
}

export const TimeIndicator = ({ view, selectedDate }: TimeIndicatorProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Only show the time indicator in day and week views, and only if the selectedDate is today
  if (view === "month" || !isToday(selectedDate)) {
    return null;
  }

  const totalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  // Calculate position: Start at 6 AM (6*60 = 360 minutes) as that's when our day display begins
  const position = ((totalMinutes - 360) / (24 * 60)) * 100;

  if (position < 0 || position > 100) {
    return null; // Time is outside our visible range (before 6 AM or after 6 AM next day)
  }

  return (
    <div
      className="absolute left-0 right-0 h-0.5 bg-red-500 z-10"
      style={{ top: `${position}%` }}
    >
      <div className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
      <div className="absolute -top-1.5 right-0 px-2 py-1 text-xs text-white bg-red-500 rounded shadow">
        {currentTime.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })}
      </div>
    </div>
  );
};
