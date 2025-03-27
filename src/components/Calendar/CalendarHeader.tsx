
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarViewType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarHeaderProps {
  selectedDate: Date;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAddEvent: () => void;
  isPublic?: boolean;
}

export const CalendarHeader = ({
  selectedDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onAddEvent,
  isPublic = false,
}: CalendarHeaderProps) => {
  const { language } = useLanguage();
  const locale = language === 'es' ? es : undefined;

  const formatTitle = () => {
    const formatOptions: Record<CalendarViewType, string> = {
      day: "EEEE, MMMM d, yyyy",
      week: "MMMM d, yyyy",
      month: "MMMM yyyy",
    };

    return format(selectedDate, formatOptions[view], { locale });
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevious}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-[150px] text-center">
          {formatTitle()}
        </h2>
        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex border bg-muted rounded-md overflow-hidden">
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className="rounded-none"
          >
            {language === 'es' ? 'Día' : 'Day'}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className="rounded-none"
          >
            {language === 'es' ? 'Semana' : 'Week'}
          </Button>
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className="rounded-none"
          >
            {language === 'es' ? 'Mes' : 'Month'}
          </Button>
        </div>
        
        {!isPublic && (
          <Button size="sm" onClick={onAddEvent} className="ml-2">
            <Plus className="mr-1 h-4 w-4" />
            {language === 'es' ? 'Añadir Evento' : 'Add Event'}
          </Button>
        )}
      </div>
    </div>
  );
};
