
import { format } from "date-fns";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Reorder hours to start from 9 AM
const HOURS = [
  ...Array.from({ length: 15 }, (_, i) => i + 9), // 9 AM to 23 (11 PM)
  ...Array.from({ length: 9 }, (_, i) => i) // 0 AM to 8 AM
];

export const TimeIndicator = () => {
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  return (
    <div className={`${isMobile ? 'w-10' : 'w-16'} flex-shrink-0 border-r border-border bg-background`}>
      {/* Adding a spacer for the week/day header that exists in the main grid */}
      <div className="h-8 border-b border-gray-200"></div>
      
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-12 border-b border-border text-xs text-muted-foreground flex items-start"
          >
            {/* Precise vertical alignment for mobile and desktop */}
            <div className={`${isMobile ? 'pl-0.5' : 'pl-2'} transform -translate-y-[1px]`}>
              {isMobile ? format(date, 'ha').replace('am', '').replace('pm', '') : format(date, 'h a')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
