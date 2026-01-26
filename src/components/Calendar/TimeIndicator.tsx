
import { format } from "date-fns";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Reorder hours to start from 9 AM
const HOURS = [
  ...Array.from({ length: 15 }, (_, i) => i + 9), // 9 AM to 23 (11 PM)
  ...Array.from({ length: 9 }, (_, i) => i) // 0 AM to 8 AM
];

interface TimeIndicatorProps {
  view: 'day' | 'week';
}

export const TimeIndicator = ({ view }: TimeIndicatorProps) => {
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  // Week view has h-12 header on mobile, h-10 on desktop
  // Day view has h-10 header on all devices
  const headerSpacerClass = view === 'week' && isMobile ? 'h-12' : 'h-10';
  
  // Adjust top padding to align timestamps with grid borders
  // Week view mobile needs more offset, day view needs less
  const getTimestampPadding = () => {
    if (!isMobile) return 'pt-0.5';
    return view === 'week' ? 'pt-3' : 'pt-1';
  };
  
  return (
    <div className="w-12 sm:w-14 flex-shrink-0 border-r border-border/30 bg-muted/10">
      {/* Spacer to match the header height */}
      <div className={`${headerSpacerClass} border-b border-border/25`}></div>
      
      {HOURS.map((hour) => {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        
        return (
          <div
            key={hour}
            className="h-12 border-b border-border/20 text-[0.65rem] sm:text-xs flex items-start justify-end"
          >
            <div className={`pr-1.5 sm:pr-2 ${getTimestampPadding()} font-medium text-foreground/50`}>
              {isMobile ? format(date, 'ha').replace('am', '').replace('pm', '') : format(date, 'h a')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
