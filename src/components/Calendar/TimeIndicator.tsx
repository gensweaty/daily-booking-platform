
import { format } from "date-fns";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Reorder hours to start from 6 AM
const HOURS = [
  ...Array.from({ length: 18 }, (_, i) => i + 6), // 6 AM to 23 PM
  ...Array.from({ length: 6 }, (_, i) => i) // 0 AM to 5 AM
];

export const TimeIndicator = () => {
  const isMobile = useMediaQuery("(max-width: 640px)");

  return (
    <div className={`${isMobile ? 'w-8' : 'w-16'} flex-shrink-0 border-r border-border bg-background`}>
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-24 border-b border-border text-xs text-muted-foreground relative"
          >
            <span className={`absolute ${isMobile ? 'top-[12px] left-1' : 'top-[12px] left-2'}`}>
              {format(date, isMobile ? 'h' : 'h a')}
            </span>
          </div>
        );
      })}
    </div>
  );
};
