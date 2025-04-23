
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { es } from 'date-fns/locale';
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useTheme } from "next-themes";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const { language } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = React.useState<string | undefined>(theme);
  const isDarkTheme = currentTheme === "dark";

  // Listen for theme changes
  React.useEffect(() => {
    // Update state when theme changes from context
    setCurrentTheme(theme);
    
    // Listen for manual theme changes
    const handleThemeChange = (event: CustomEvent) => {
      setCurrentTheme(event.detail.theme);
    };
    
    // Listen for initial theme
    const handleThemeInit = (event: CustomEvent) => {
      setCurrentTheme(event.detail.theme);
    };

    // Add event listeners
    document.addEventListener('themeChanged', handleThemeChange as EventListener);
    document.addEventListener('themeInit', handleThemeInit as EventListener);
    
    return () => {
      // Remove event listeners
      document.removeEventListener('themeChanged', handleThemeChange as EventListener);
      document.removeEventListener('themeInit', handleThemeInit as EventListener);
    };
  }, [theme, setTheme]);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 pointer-events-auto", className)}
      locale={language === 'es' ? es : undefined}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: cn("text-sm font-medium", isDarkTheme ? "text-white" : ""),
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          isDarkTheme ? "border-gray-700 hover:bg-gray-800" : ""
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: cn(
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          isDarkTheme ? "text-gray-400" : ""
        ),
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          isDarkTheme ? "text-gray-300" : "",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
          isDarkTheme ? "[&:has([aria-selected])]:bg-gray-800" : "[&:has([aria-selected])]:bg-accent"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
          isDarkTheme 
            ? "hover:bg-gray-800 hover:text-white text-gray-300" 
            : "hover:bg-accent hover:text-accent-foreground"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected: cn(
          isDarkTheme 
            ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white focus:bg-indigo-700 focus:text-white" 
            : "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
        ),
        day_today: cn(
          isDarkTheme 
            ? "bg-gray-800 text-white" 
            : "bg-accent text-accent-foreground"
        ),
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: cn(
          isDarkTheme 
            ? "aria-selected:bg-gray-800 aria-selected:text-white" 
            : "aria-selected:bg-accent aria-selected:text-accent-foreground"
        ),
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
