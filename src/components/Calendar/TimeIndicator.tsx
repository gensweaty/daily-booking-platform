
import { useEffect, useState } from "react";

const HOURS = [
  ...Array.from({ length: 18 }, (_, i) => i + 6), // 6 AM to 23 PM
  ...Array.from({ length: 6 }, (_, i) => i) // 0 AM to 5 AM
];

export const TimeIndicator = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Add responsive check for mobile devices
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatHour = (hour: number) => {
    if (isMobile) {
      // Even simpler hour format for mobile
      if (hour === 0) return "12a";
      if (hour === 12) return "12p";
      return hour < 12 ? `${hour}a` : `${hour - 12}p`;
    } else {
      // Full format for desktop
      if (hour === 0) return "12am";
      if (hour === 12) return "12pm";
      return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
    }
  };

  return (
    <div className="w-10 md:w-16 pr-1 md:pr-2 pt-8 flex-shrink-0">
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="relative border-t border-transparent"
          style={{ height: "6rem" }}
        >
          <span className="absolute -top-2.5 right-0 text-[10px] md:text-xs text-muted-foreground">
            {formatHour(hour)}
          </span>
        </div>
      ))}
    </div>
  );
};
