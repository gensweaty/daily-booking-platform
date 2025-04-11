
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
    <div className={`${isMobile ? 'w-12' : 'w-16'} flex-shrink-0 border-r border-border bg-background`}>
      {/* Adding a spacer for the week/day header that exists in the main grid */}
      <div className="h-8 border-b border-gray-200"></div>
      
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-24 border-b border-border text-xs text-muted-foreground flex items-start"
          >
            {/* Precise vertical alignment for mobile and desktop */}
            <div className={`${isMobile ? 'pl-1' : 'pl-2'} transform -translate-y-[1px]`}>
              {isMobile ? format(date, 'h a').replace(' ', '') : format(date, 'h a')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
