
import { useState, useEffect } from "react";
import { differenceInMinutes, setHours, setMinutes } from "date-fns";

interface TimeIndicatorProps {
  currentDate: Date;
}

export const TimeIndicator: React.FC<TimeIndicatorProps> = ({ currentDate }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(intervalId);
  }, []);

  const startOfDay = setHours(setMinutes(currentDate, 0), 0);
  const currentPosition = differenceInMinutes(currentTime, startOfDay);

  return (
    <div
      className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
      style={{ top: currentPosition }}
    >
      <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-red-500" />
    </div>
  );
};
