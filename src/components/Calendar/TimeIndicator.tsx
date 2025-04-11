
import { format } from "date-fns";

// Reorder hours to start from 6 AM
const HOURS = [
  ...Array.from({ length: 18 }, (_, i) => i + 6), // 6 AM to 23 PM
  ...Array.from({ length: 6 }, (_, i) => i) // 0 AM to 5 AM
];

export const TimeIndicator = () => {
  return (
    <div className="w-16 flex-shrink-0 border-r border-border bg-background">
      {HOURS.map((hour, index) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-24 border-b border-border relative"
          >
            {/* Adjust the positioning to match the example image - at the center of grid cell */}
            <span className="absolute top-[12px] left-2 text-xs text-muted-foreground">
              {format(date, 'h a')}
            </span>
          </div>
        );
      })}
    </div>
  );
};
