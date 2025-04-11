
import { format } from "date-fns";

// Reorder hours to start from 6 AM
const HOURS = [
  ...Array.from({ length: 18 }, (_, i) => i + 6), // 6 AM to 23 PM
  ...Array.from({ length: 6 }, (_, i) => i) // 0 AM to 5 AM
];

export const TimeIndicator = () => {
  return (
    <div className="w-16 flex-shrink-0 border-r border-border bg-background">
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
            {/* Using transform to fine-tune the alignment perfectly */}
            <div className="pl-2 transform -translate-y-[0.5px]">
              {format(date, 'h a')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
