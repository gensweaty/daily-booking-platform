
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

  // Fix the handle view change to prevent switching if already on that view
  const handleViewChange = (newView: CalendarViewType) => {
    if (view !== newView) {
      onViewChange(newView);
    }
  };

  return (
    <div className="flex flex-col gap-3 mb-1">
      {/* Month/Year display with navigation arrows */}
      <div className="flex justify-between items-center">
        <Button variant="outline" size="icon" onClick={onPrevious} className="h-12 w-12 flex-shrink-0 rounded-lg">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        
        <h2 className="text-xl font-semibold text-center">{getFormattedDate()}</h2>
        
        <Button variant="outline" size="icon" onClick={onNext} className="h-12 w-12 flex-shrink-0 rounded-lg">
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* View switcher and Add Event button */}
      <div className="flex justify-between items-center gap-4">
        {/* View switcher with rounded corners - ensure full width on mobile */}
        <div className={`flex rounded-full overflow-hidden border border-input bg-white ${isMobile ? 'w-[150px]' : ''}`}>
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("month")}
            className={`px-4 py-2 rounded-none text-sm ${isMobile ? 'flex-1' : ''} ${view === "month" ? "bg-[#9b87f5] text-white hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.month")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("week")}
            className={`px-4 py-2 rounded-none text-sm ${isMobile ? 'flex-1' : ''} ${view === "week" ? "bg-[#9b87f5] text-white hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.week")}
          </Button>
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("day")}
            className={`px-4 py-2 rounded-none text-sm ${isMobile ? 'flex-1' : ''} ${view === "day" ? "bg-[#9b87f5] text-white hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.day")}
          </Button>
        </div>
        
        {/* Add Event button */}
        {onAddEvent && (
          <Button 
            onClick={onAddEvent} 
            size="sm" 
            className="bg-[#9b87f5] hover:bg-[#8a78de] text-white rounded-full py-2 px-4 text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            {isExternalCalendar ? t("calendar.bookNow") : t("calendar.addEvent")}
          </Button>
        )}
      </div>
    </div>
  );
};
