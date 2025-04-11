
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarViewType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";

interface CalendarHeaderProps {
  selectedDate: Date;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAddEvent?: () => void;
  isExternalCalendar?: boolean;
}

export const CalendarHeader = ({
  selectedDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onAddEvent,
  isExternalCalendar = false,
}: CalendarHeaderProps) => {
  const { t } = useLanguage();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Add responsive check for mobile devices
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getFormattedDate = () => {
    if (isMobile) {
      // Simpler format for mobile
      switch (view) {
        case "month":
        case "week":
        case "day":
          return format(selectedDate, "MMMM yyyy");
        default:
          return "";
      }
    } else {
      // Desktop format
      switch (view) {
        case "month":
          return format(selectedDate, "MMMM yyyy");
        case "week":
          return `${t("calendar.weekOf")} ${format(selectedDate, "MMM d, yyyy")}`;
        case "day":
          return format(selectedDate, "EEEE, MMMM d, yyyy");
        default:
          return "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 mb-1">
      {/* Month/Year display with navigation arrows */}
      <div className="flex justify-between items-center">
        <Button variant="outline" size="icon" onClick={onPrevious} className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 rounded-lg">
          <ChevronLeft className="h-4 w-4 sm:h-6 sm:w-6" />
        </Button>
        
        <h2 className="text-base sm:text-xl font-semibold text-center">{getFormattedDate()}</h2>
        
        <Button variant="outline" size="icon" onClick={onNext} className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 rounded-lg">
          <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6" />
        </Button>
      </div>

      {/* View switcher and Add Event button - Side by side for both mobile and desktop */}
      <div className="flex justify-between items-center gap-2">
        {/* View switcher with pill-shaped corners */}
        <div className="flex rounded-full overflow-hidden border border-input bg-white">
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className={`px-2 sm:px-4 py-1 sm:py-2 rounded-none text-xs sm:text-sm ${view === "month" ? "bg-[#9b87f5] hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.month")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className={`px-2 sm:px-4 py-1 sm:py-2 rounded-none text-xs sm:text-sm ${view === "week" ? "bg-[#9b87f5] hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.week")}
          </Button>
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className={`px-2 sm:px-4 py-1 sm:py-2 rounded-none text-xs sm:text-sm ${view === "day" ? "bg-[#9b87f5] hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.day")}
          </Button>
        </div>
        
        {/* Add Event button, maintaining the same style on mobile and desktop */}
        {onAddEvent && (
          <Button 
            onClick={onAddEvent} 
            size="sm" 
            className="bg-[#9b87f5] hover:bg-[#8a78de] px-2 sm:px-4 py-1 text-xs sm:text-sm rounded-full"
          >
            <Plus className="h-3 w-3 mr-1 sm:h-4 sm:w-4" />
            {isExternalCalendar ? t("calendar.bookNow") : t("calendar.addEvent")}
          </Button>
        )}
      </div>
    </div>
  );
};
