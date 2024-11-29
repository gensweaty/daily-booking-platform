import { format } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const TimeIndicator = () => {
  return (
    <div className="w-12 sm:w-16 flex-shrink-0 border-r border-border bg-background">
      <div className="h-20 border-b border-border" /> {/* Empty cell for header alignment */}
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-20 border-b border-border text-xs text-muted-foreground relative"
          >
            <span className="absolute top-[-10px] right-1 sm:right-2">
              {format(date, 'h a')}
            </span>
          </div>
        );
      })}
    </div>
  );
};