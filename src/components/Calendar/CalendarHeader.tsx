
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
    <div className="flex flex-col gap-4">
      {/* Top row: Navigation and date */}
      <div className="flex items-center justify-between">
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
        
        {/* Presence circles on right */}
        {onlineUsers.length > 0 && (
          <div>
            <PresenceCircles users={onlineUsers} currentUserEmail={currentUserEmail} max={5} />
          </div>
        )}
      </div>

      {/* Bottom row: Centered switcher with Add Event on right */}
      <div className="flex items-center justify-center relative">
        {/* Centered pill-shaped view switcher with glow effect - more prominent */}
        <div className="flex gap-1 bg-muted/50 dark:bg-muted/30 backdrop-blur-md rounded-full p-1.5 border border-border/40 dark:border-border/30 shadow-lg">
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className={cn(
              "px-5 sm:px-6 py-2 rounded-full transition-all duration-300 font-semibold text-sm",
              view === "day" 
                ? "shadow-xl shadow-primary/40 dark:shadow-primary/50 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/70 dark:hover:bg-muted/40 text-foreground/70 hover:text-foreground"
            )}
          >
            {renderButtonText("day")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className={cn(
              "px-5 sm:px-6 py-2 rounded-full transition-all duration-300 font-semibold text-sm",
              view === "week" 
                ? "shadow-xl shadow-primary/40 dark:shadow-primary/50 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/70 dark:hover:bg-muted/40 text-foreground/70 hover:text-foreground"
            )}
          >
            {renderButtonText("week")}
          </Button>
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className={cn(
              "px-5 sm:px-6 py-2 rounded-full transition-all duration-300 font-semibold text-sm",
              view === "month" 
                ? "shadow-xl shadow-primary/40 dark:shadow-primary/50 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/70 dark:hover:bg-muted/40 text-foreground/70 hover:text-foreground"
            )}
          >
            {renderButtonText("month")}
          </Button>
        </div>
        {/* Add Event button positioned on right */}
        {onAddEvent && (
          <div className="absolute right-0">
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
          </div>
        )}
      </div>
    </div>
  );
};
