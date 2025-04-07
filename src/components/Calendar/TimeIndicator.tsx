
import { differenceInMinutes } from "date-fns";
import { useEffect, useState } from "react";

interface TimeIndicatorProps {
  selectedDate: Date;
}

export const TimeIndicator = ({ selectedDate }: TimeIndicatorProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const startOfDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    0,
    0,
    0
  );

  const position = differenceInMinutes(currentTime, startOfDay);

  return (
    <div
      className="absolute left-0 w-full h-0.5 bg-red-500 z-10"
      style={{ top: position }}
    >
      <div className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
    </div>
  );
};
