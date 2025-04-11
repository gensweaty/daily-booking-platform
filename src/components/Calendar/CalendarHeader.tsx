
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarViewType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

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

  const getFormattedDate = () => {
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
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Month/Year display with navigation arrows */}
      <div className="flex justify-between items-center">
        <Button variant="outline" size="icon" onClick={onPrevious} className="h-12 w-12 md:h-10 md:w-10">
          <ChevronLeft className="h-6 w-6 md:h-4 md:w-4" />
        </Button>
        
        <h2 className="text-xl font-semibold text-center">{getFormattedDate()}</h2>
        
        <Button variant="outline" size="icon" onClick={onNext} className="h-12 w-12 md:h-10 md:w-10">
          <ChevronRight className="h-6 w-6 md:h-4 md:w-4" />
        </Button>
      </div>

      {/* View switcher and Add Event button */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex rounded-md overflow-hidden border border-input">
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className={`px-4 py-2 rounded-none ${view === "month" ? "bg-[#9b87f5] hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.month")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className={`px-4 py-2 rounded-none ${view === "week" ? "bg-[#9b87f5] hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.week")}
          </Button>
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className={`px-4 py-2 rounded-none ${view === "day" ? "bg-[#9b87f5] hover:bg-[#8a78de]" : "hover:bg-gray-100"}`}
          >
            {t("calendar.day")}
          </Button>
        </div>
        
        {onAddEvent && (
          <Button onClick={onAddEvent} size="sm" className="bg-[#9b87f5] hover:bg-[#8a78de] px-4">
            <Plus className="h-4 w-4 mr-1" />
            {isExternalCalendar ? t("calendar.bookNow") : t("calendar.addEvent")}
          </Button>
        )}
      </div>
    </div>
  );
};
