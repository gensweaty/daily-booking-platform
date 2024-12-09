import { format } from "date-fns";

// Reorder hours to start from 6 AM
const HOURS = [
  ...Array.from({ length: 18 }, (_, i) => i + 6), // 6 AM to 23 PM
  ...Array.from({ length: 6 }, (_, i) => i) // 0 AM to 5 AM
];

export const TimeIndicator = () => {
  return (
    <div className="w-12 flex-shrink-0 border-r border-border bg-background">
      <div className="h-20 border-b border-border" /> {/* Empty cell for header alignment */}
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-20 border-b border-border text-xs text-muted-foreground relative"
          >
            <span className="absolute top-[-10px] left-0">
              {format(date, 'h a')}
            </span>
          </div>
        );
      })}
    </div>
  );
};