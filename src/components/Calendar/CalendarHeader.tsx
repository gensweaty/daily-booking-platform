
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarViewType } from "@/lib/types/calendar";

interface CalendarHeaderProps {
  selectedDate: Date;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAddEvent?: () => void;
  visibleDate?: Date;
  onVisibleDateChange?: (date: Date) => void;
}

export const CalendarHeader = ({
  selectedDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onAddEvent,
  visibleDate,
}: CalendarHeaderProps) => {
  const { language, t } = useLanguage();
  
  // Always format a valid date
  const dateToFormat = visibleDate || selectedDate;
  const isValidDate = dateToFormat && dateToFormat instanceof Date && !isNaN(dateToFormat.getTime());
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
        <Button variant="outline" size="icon" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg sm:text-xl font-semibold">
          {isValidDate 
            ? format(dateToFormat, "MMMM yyyy", { locale: language === 'es' ? es : undefined })
            : "Invalid Date"}
        </h2>
        <Button variant="outline" size="icon" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex rounded-lg border border-input overflow-hidden flex-1 sm:flex-none">
          <Button
            variant={view === "month" ? "default" : "ghost"}
            className="rounded-none px-2 sm:px-4 text-sm flex-1"
            onClick={() => onViewChange("month")}
          >
            {t("dashboard.month")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            className="rounded-none px-2 sm:px-4 text-sm flex-1"
            onClick={() => onViewChange("week")}
          >
            {t("dashboard.week")}
          </Button>
          <Button
            variant={view === "day" ? "default" : "ghost"}
            className="rounded-none px-2 sm:px-4 text-sm flex-1"
            onClick={() => onViewChange("day")}
          >
            {t("dashboard.day")}
          </Button>
        </div>
        {onAddEvent && (
          <Button onClick={onAddEvent} className="whitespace-nowrap">
            {t("dashboard.addEvent")}
          </Button>
        )}
      </div>
    </div>
  );
};
