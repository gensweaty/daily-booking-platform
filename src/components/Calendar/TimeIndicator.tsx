import { format } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const TimeIndicator = () => {
  return (
    <div className="w-16 flex-shrink-0 border-r border-gray-200">
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="h-20 border-b border-gray-100 text-xs text-gray-500 relative"
        >
          <span className="absolute -top-2 right-2">
            {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
          </span>
        </div>
      ))}
    </div>
  );
};