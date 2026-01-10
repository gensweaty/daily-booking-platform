
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarViewType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { useLocalizedDate } from "@/hooks/useLocalizedDate";
import { PresenceCircles } from "@/components/presence/PresenceCircles";

interface CalendarHeaderProps {
  selectedDate: Date;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAddEvent?: () => void;
  isExternalCalendar?: boolean;
  onlineUsers?: Array<{ email?: string | null; name?: string | null; avatar_url?: string | null; online_at?: string | null }>;
  currentUserEmail?: string;
}

export const CalendarHeader = ({
  selectedDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onAddEvent,
  isExternalCalendar = false,
  onlineUsers = [],
  currentUserEmail,
}: CalendarHeaderProps) => {
  const { t, language } = useLanguage();
  const { formatDate } = useLocalizedDate();
  const isGeorgian = language === 'ka';

  // Debug logging for onAddEvent
  console.log('🔍 CalendarHeader: onAddEvent provided?', !!onAddEvent, 'isExternalCalendar:', isExternalCalendar);

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
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onPrevious}
            className="rounded-xl border-border/50 hover:bg-muted/50 transition-all duration-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onNext}
            className="rounded-xl border-border/50 hover:bg-muted/50 transition-all duration-200"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className={cn(
            "text-xl font-semibold ml-2 tracking-tight",
            isGeorgian ? "font-georgian" : ""
          )}>
            {getFormattedDate()}
          </h2>
        </div>
        
        {/* Presence circles inline with date on mobile */}
        {onlineUsers.length > 0 && (
          <div className="ml-auto">
            <PresenceCircles users={onlineUsers} currentUserEmail={currentUserEmail} max={5} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center w-full sm:w-auto mt-2 sm:mt-0">
        {/* Centered pill-shaped view switcher with glow effect */}
        <div className="flex gap-0.5 mx-auto sm:mx-0 bg-muted/40 dark:bg-muted/20 backdrop-blur-sm rounded-full p-1 border border-border/30 dark:border-border/20">
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className={cn(
              "px-4 sm:px-5 rounded-full transition-all duration-300 font-medium",
              view === "day" 
                ? "shadow-lg shadow-primary/30 dark:shadow-primary/40 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/60 dark:hover:bg-muted/30 text-muted-foreground hover:text-foreground"
            )}
          >
            {renderButtonText("day")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className={cn(
              "px-4 sm:px-5 rounded-full transition-all duration-300 font-medium",
              view === "week" 
                ? "shadow-lg shadow-primary/30 dark:shadow-primary/40 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/60 dark:hover:bg-muted/30 text-muted-foreground hover:text-foreground"
            )}
          >
            {renderButtonText("week")}
          </Button>
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className={cn(
              "px-4 sm:px-5 rounded-full transition-all duration-300 font-medium",
              view === "month" 
                ? "shadow-lg shadow-primary/30 dark:shadow-primary/40 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/60 dark:hover:bg-muted/30 text-muted-foreground hover:text-foreground"
            )}
          >
            {renderButtonText("month")}
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {onAddEvent && (
            <Button 
              onClick={onAddEvent}
              size="sm" 
              variant="dynamic"
              className={cn(
                "font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]",
                isGeorgian ? "font-georgian" : ""
              )}
              type="button"
            >
              <Plus className="h-4 w-4" />
              {isExternalCalendar ? t("calendar.bookNow") : t("calendar.addEvent")}
            </Button>
          )}
        </div>
        
      </div>
    </div>
  );
};
