
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
    <div className="w-14 sm:w-16 flex-shrink-0 border-r-2 border-border/60 bg-muted/40">
      {/* Adding a spacer for the week/day header that exists in the main grid */}
      <div className="h-10 border-b-2 border-border/60 bg-muted/50"></div>
      
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-12 border-b border-border/50 text-xs flex items-start justify-end bg-muted/20"
          >
            <div className="pr-2 sm:pr-3 pt-1 font-semibold text-muted-foreground">
              {isMobile ? format(date, 'ha').replace('am', '').replace('pm', '') : format(date, 'h a')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
