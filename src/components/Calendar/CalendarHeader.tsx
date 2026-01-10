
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { CalendarViewType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { useLocalizedDate } from "@/hooks/useLocalizedDate";
import { PresenceCircles } from "@/components/presence/PresenceCircles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  preferredView?: CalendarViewType;
  onSetPreferredView?: (view: CalendarViewType) => void;
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
  preferredView,
  onSetPreferredView,
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
        // Shorter format for week
        return formatDate(selectedDate, "dayMonth");
      case "day":
        return formatDate(selectedDate, "dayMonth");
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
    <div className="flex items-center justify-between gap-1 sm:gap-2">
      {/* Left: Navigation arrows and date */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onPrevious}
          className="rounded-xl border-border/50 hover:bg-muted/50 transition-all duration-200 h-7 w-7 sm:h-8 sm:w-8"
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onNext}
          className="rounded-xl border-border/50 hover:bg-muted/50 transition-all duration-200 h-7 w-7 sm:h-8 sm:w-8"
        >
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <h2 className={cn(
          "text-xs sm:text-base font-semibold ml-0.5 sm:ml-1 tracking-tight whitespace-nowrap",
          isGeorgian ? "font-georgian" : ""
        )}>
          {getFormattedDate()}
        </h2>
      </div>

      {/* Center: View switcher */}
      <div className="flex items-center gap-0.5 sm:gap-1.5">
        <div className="flex gap-0.5 sm:gap-1 bg-muted/50 dark:bg-muted/30 backdrop-blur-md rounded-full p-1 sm:p-1.5 border border-border/40 dark:border-border/30 shadow-lg">
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className={cn(
              "px-2 sm:px-5 py-1 sm:py-1.5 rounded-full transition-all duration-300 font-semibold text-[0.65rem] sm:text-sm relative",
              view === "day" 
                ? "shadow-xl shadow-primary/40 dark:shadow-primary/50 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/70 dark:hover:bg-muted/40 text-foreground/70 hover:text-foreground"
            )}
          >
            {renderButtonText("day")}
            {preferredView === "day" && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border border-background" />
            )}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className={cn(
              "px-2 sm:px-5 py-1 sm:py-1.5 rounded-full transition-all duration-300 font-semibold text-[0.65rem] sm:text-sm relative",
              view === "week" 
                ? "shadow-xl shadow-primary/40 dark:shadow-primary/50 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/70 dark:hover:bg-muted/40 text-foreground/70 hover:text-foreground"
            )}
          >
            {renderButtonText("week")}
            {preferredView === "week" && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border border-background" />
            )}
          </Button>
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className={cn(
              "px-2 sm:px-5 py-1 sm:py-1.5 rounded-full transition-all duration-300 font-semibold text-[0.65rem] sm:text-sm relative",
              view === "month" 
                ? "shadow-xl shadow-primary/40 dark:shadow-primary/50 bg-primary hover:bg-primary/90" 
                : "hover:bg-muted/70 dark:hover:bg-muted/40 text-foreground/70 hover:text-foreground"
            )}
          >
            {renderButtonText("month")}
            {preferredView === "month" && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border border-background" />
            )}
          </Button>
        </div>
        
        {/* Pin button to save current view as default */}
        {onSetPreferredView && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSetPreferredView(view)}
                  className={cn(
                    "h-7 w-7 sm:h-8 sm:w-8 rounded-full transition-all duration-200",
                    preferredView === view 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Pin className={cn(
                    "h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform",
                    preferredView === view && "fill-current"
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {preferredView === view 
                  ? t("calendar.currentDefault") || "Current default view"
                  : t("calendar.setAsDefault") || "Set as default view"
                }
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Right: Presence + Add Event */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {onlineUsers.length > 0 && (
          <PresenceCircles users={onlineUsers} currentUserEmail={currentUserEmail} max={5} />
        )}
        {onAddEvent && (
          <>
            {/* Mobile: Icon only button */}
            <Button 
              onClick={onAddEvent}
              size="icon" 
              variant="dynamic"
              className="sm:hidden font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 h-7 w-7"
              type="button"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {/* Desktop: Full button with text */}
            <Button 
              onClick={onAddEvent}
              size="sm" 
              variant="dynamic"
              className={cn(
                "hidden sm:flex font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]",
                isGeorgian ? "font-georgian" : ""
              )}
              type="button"
            >
              <Plus className="h-4 w-4" />
              {isExternalCalendar ? t("calendar.bookNow") : t("calendar.addEvent")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
