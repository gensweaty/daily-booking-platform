
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarViewType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { useLocalizedDate } from "@/hooks/useLocalizedDate";

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
  const { t, language } = useLanguage();
  const { formatDate } = useLocalizedDate();
  const isGeorgian = language === 'ka';

  const getFormattedDate = () => {
    switch (view) {
      case "month":
        return formatDate(selectedDate, "monthYear");
      case "week":
        // Remove the redundant "კვირა" prefix since formatDate already includes it
        return formatDate(selectedDate, "weekOf");
      case "day":
        return formatDate(selectedDate, "full");
      default:
        return "";
    }
  };

  // Helper function to render the button text with Georgian font fix
  const renderButtonText = (viewType: string) => {
    if (isGeorgian) {
      if (viewType === "day") {
        return <GeorgianAuthText>დღე</GeorgianAuthText>;
      } else if (viewType === "week") {
        return <GeorgianAuthText>კვირა</GeorgianAuthText>;
      } else if (viewType === "month") {
        return <GeorgianAuthText>თვე</GeorgianAuthText>;
      }
    }
    
    return t(`calendar.${viewType}`);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className={cn("text-xl font-semibold ml-2", isGeorgian ? "font-georgian" : "")}>
          {getFormattedDate()}
        </h2>
      </div>

      <div className="flex flex-wrap gap-2 justify-between w-full sm:w-auto mt-2 sm:mt-0">
        <div className="flex gap-1 mr-auto sm:mr-2">
          <Button
            variant={view === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("day")}
            className={cn("px-2 sm:px-4")}
          >
            {renderButtonText("day")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("week")}
            className={cn("px-2 sm:px-4")}
          >
            {renderButtonText("week")}
          </Button>
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("month")}
            className={cn("px-2 sm:px-4")}
          >
            {renderButtonText("month")}
          </Button>
        </div>
        
        {onAddEvent && (
          <Button 
            onClick={onAddEvent} 
            size="sm" 
            variant="dynamic"
            className={cn("ml-auto sm:ml-0 font-semibold", isGeorgian ? "font-georgian" : "")}
          >
            <Plus className="h-4 w-4" />
            {isExternalCalendar ? t("calendar.bookNow") : t("calendar.addEvent")}
          </Button>
        )}
      </div>
    </div>
  );
};
