
import { format } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarViewType } from "@/lib/types/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { es } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarHeaderProps {
  selectedDate: Date;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAddEvent?: () => void;
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

  const getTitle = () => {
    switch (view) {
      case "month":
        return format(selectedDate, "MMMM yyyy", { locale });
      case "week":
        return `${format(selectedDate, "MMMM d", { locale })} - ${format(
          selectedDate,
          "d yyyy",
          { locale }
        )}`;
      case "day":
        return format(selectedDate, "EEEE, MMMM d, yyyy", { locale });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 justify-between">
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center justify-center gap-1 bg-background rounded-lg shadow-sm border border-border p-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            className="h-7 w-7"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium flex items-center gap-1">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{getTitle()}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="h-7 w-7"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!isPublic && onAddEvent && (
          <Button size="sm" onClick={onAddEvent} className="h-8">
            <Plus className="h-4 w-4 mr-1" />
            Event
          </Button>
        )}
      </div>

      <Tabs value={view} onValueChange={(value) => onViewChange(value as CalendarViewType)}>
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};
