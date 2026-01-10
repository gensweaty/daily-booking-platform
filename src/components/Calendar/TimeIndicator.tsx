
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
    <div className={`${isMobile ? 'w-12' : 'w-16'} flex-shrink-0 border-r border-border/50 bg-muted/30`}>
      {/* Adding a spacer for the week/day header that exists in the main grid */}
      <div className="h-8 border-b border-border/50"></div>
      
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-12 border-b border-border/40 text-xs text-muted-foreground flex items-start justify-end"
          >
            <div className={`${isMobile ? 'pr-1.5' : 'pr-2.5'} pt-1 font-medium text-muted-foreground/80`}>
              {isMobile ? format(date, 'ha').replace('am', '').replace('pm', '') : format(date, 'h a')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
