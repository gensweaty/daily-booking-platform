import { format } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const TimeIndicator = () => {
  return (
    <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="h-20 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 relative"
        >
          <span className="absolute -top-3.5 right-2.5 whitespace-nowrap">
            {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
          </span>
        </div>
      ))}
    </div>
  );
};