
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
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
}

export const CalendarHeader = ({
  selectedDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onAddEvent,
}: CalendarHeaderProps) => {
  const { language } = useLanguage();
  const locale = language === 'es' ? es : undefined;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-bold tracking-tight hidden sm:block">
          {format(selectedDate, "MMMM yyyy", { locale })}
        </h2>
        <h2 className="text-xl font-bold tracking-tight sm:hidden">
          {format(selectedDate, "MMM yyyy", { locale })}
        </h2>
        <div className="flex items-center">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            className="h-7 w-7"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            className="h-7 w-7 ml-1"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <div className="hidden sm:flex bg-muted rounded-md p-1">
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className="text-xs h-7"
          >
            Day
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className="text-xs h-7"
          >
            Week
          </Button>
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className="text-xs h-7"
          >
            Month
          </Button>
        </div>
        <div className="sm:hidden bg-muted rounded-md p-1">
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className="text-xs h-7 px-2"
          >
            D
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className="text-xs h-7 px-2"
          >
            W
          </Button>
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className="text-xs h-7 px-2"
          >
            M
          </Button>
        </div>
        
        {onAddEvent && (
          <Button size="sm" onClick={onAddEvent} className="h-7">
            <Plus className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Add Event</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>
    </div>
  );
};
