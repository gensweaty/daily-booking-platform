
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarViewType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { useLocalizedDate } from "@/hooks/useLocalizedDate";
import { motion } from "framer-motion";

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
        return formatDate(selectedDate, "weekOf");
      case "day":
        return formatDate(selectedDate, "full");
      default:
        return "";
    }
  };

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
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.1 }}
        >
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onPrevious}
            className="hover:bg-accent/50 hover:border-accent transition-all duration-200 hover:shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </motion.div>
        
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.1 }}
        >
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onNext}
            className="hover:bg-accent/50 hover:border-accent transition-all duration-200 hover:shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </motion.div>

        <motion.h2 
          className={cn(
            "text-xl font-semibold ml-2 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent hover:from-primary hover:to-primary/80 transition-all duration-300 cursor-default",
            isGeorgian ? "font-georgian" : ""
          )}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          {getFormattedDate()}
        </motion.h2>
      </div>

      <div className="flex flex-wrap gap-2 justify-between w-full sm:w-auto mt-2 sm:mt-0">
        <div className="flex gap-1 mr-auto sm:mr-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant={view === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => onViewChange("day")}
              className={cn(
                "px-2 sm:px-4 transition-all duration-200",
                view === "day" 
                  ? "shadow-md hover:shadow-lg" 
                  : "hover:bg-accent/50 hover:border-accent hover:shadow-sm"
              )}
            >
              {renderButtonText("day")}
            </Button>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant={view === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => onViewChange("week")}
              className={cn(
                "px-2 sm:px-4 transition-all duration-200",
                view === "week" 
                  ? "shadow-md hover:shadow-lg" 
                  : "hover:bg-accent/50 hover:border-accent hover:shadow-sm"
              )}
            >
              {renderButtonText("week")}
            </Button>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant={view === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => onViewChange("month")}
              className={cn(
                "px-2 sm:px-4 transition-all duration-200",
                view === "month" 
                  ? "shadow-md hover:shadow-lg" 
                  : "hover:bg-accent/50 hover:border-accent hover:shadow-sm"
              )}
            >
              {renderButtonText("month")}
            </Button>
          </motion.div>
        </div>
        
        {onAddEvent && (
          <motion.div 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <Button 
              onClick={onAddEvent} 
              size="sm" 
              className={cn(
                "ml-auto sm:ml-0 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200",
                isGeorgian ? "font-georgian" : ""
              )}
            >
              <motion.div
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.2 }}
              >
                <Plus className="h-4 w-4 mr-1" />
              </motion.div>
              {isExternalCalendar ? t("calendar.bookNow") : t("calendar.addEvent")}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
