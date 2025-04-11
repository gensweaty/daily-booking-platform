
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
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold ml-2">{getFormattedDate()}</h2>
      </div>

      <div className="flex gap-2 justify-between">
        <div className="flex gap-1">
          <Button
            variant={view === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("day")}
          >
            {t("calendar.day")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("week")}
          >
            {t("calendar.week")}
          </Button>
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("month")}
          >
            {t("calendar.month")}
          </Button>
        </div>
        
        {onAddEvent && (
          <Button onClick={onAddEvent} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {isExternalCalendar ? t("calendar.bookNow") : t("calendar.addEvent")}
          </Button>
        )}
      </div>
    </div>
  );
};
