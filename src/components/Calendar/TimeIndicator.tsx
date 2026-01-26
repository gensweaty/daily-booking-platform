
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
    <div className="w-12 sm:w-14 flex-shrink-0 border-r border-border/30 bg-muted/10">
      {/* Adding a spacer for the week/day header - h-12 on mobile matches the taller header */}
      <div className="h-12 sm:h-10 border-b border-border/25"></div>
      
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-12 border-b border-border/20 text-[0.65rem] sm:text-xs flex items-start justify-end"
          >
            {/* On mobile, add extra top padding to align timestamp with grid border */}
            <div className="pr-1.5 sm:pr-2 pt-2.5 sm:pt-0.5 font-medium text-foreground/50">
              {isMobile ? format(date, 'ha').replace('am', '').replace('pm', '') : format(date, 'h a')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
