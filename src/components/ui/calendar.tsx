
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { es } from 'date-fns/locale';
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { georgianMonths, georgianWeekdays } from "@/lib/dateLocalization";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Enhanced Georgian locale object with proper month and weekday support
const georgianLocale = {
  localize: {
    month: (monthIndex: number) => {
      return georgianMonths[monthIndex];
    },
    day: (dayIndex: number) => {
      return georgianWeekdays[dayIndex];
    }
  },
  formatLong: {
    date: () => 'P',
    time: () => 'p',
    dateTime: () => 'Pp'
  }
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const { language } = useLanguage();
  const { theme, resolvedTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = React.useState<string | undefined>(
    // Initialize with resolvedTheme first, fallback to theme, then check document class
    resolvedTheme || theme || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  );
  const isDarkTheme = currentTheme === "dark";
  const isGeorgian = language === 'ka';

  // Listen for theme changes
  React.useEffect(() => {
    // Update state when theme changes from context
    const newTheme = resolvedTheme || theme;
    if (newTheme) {
      setCurrentTheme(newTheme);
    }
    
    // Initial theme check from HTML class
    const checkInitialTheme = () => {
      if (typeof document !== 'undefined') {
        if (document.documentElement.classList.contains('dark')) {
          setCurrentTheme('dark');
        }
      }
    };
    
    // Check on mount
    checkInitialTheme();
    
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
    
    // Debug logging
    console.log("[Calendar UI] Current theme state:", { 
      theme, 
      resolvedTheme, 
      currentTheme,
      isDarkClass: typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    });
    
    return () => {
      // Remove event listeners
      document.removeEventListener('themeChanged', handleThemeChange as EventListener);
      document.removeEventListener('themeInit', handleThemeInit as EventListener);
    };
  }, [theme, resolvedTheme]);

  // Determine locale based on language
  const getLocale = () => {
    if (language === 'es') return es;
    if (language === 'ka') return georgianLocale as any;
    return undefined;
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-3 pointer-events-auto",
        isDarkTheme 
          ? "bg-gray-800 border border-gray-600 rounded-lg shadow-lg" 
          : "bg-white border border-gray-200 rounded-lg shadow-lg",
        isGeorgian ? "font-georgian" : "", 
        className
      )}
      locale={getLocale()}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: cn("text-sm font-medium", isDarkTheme ? "text-white" : "text-gray-900"),
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          isDarkTheme ? "border-gray-600 hover:bg-gray-700 text-white" : "border-gray-300 hover:bg-gray-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: cn(
          "rounded-md w-9 font-normal text-[0.8rem]",
          isDarkTheme ? "text-gray-300" : "text-gray-600"
        ),
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          isDarkTheme ? "text-gray-200" : "text-gray-900",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
          isDarkTheme ? "[&:has([aria-selected])]:bg-gray-700" : "[&:has([aria-selected])]:bg-blue-50"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
          isDarkTheme 
            ? "hover:bg-gray-700 hover:text-white text-gray-200" 
            : "hover:bg-gray-100 hover:text-gray-900 text-gray-900"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected: cn(
          isDarkTheme 
            ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-700 focus:text-white" 
            : "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-700 focus:text-white"
        ),
        day_today: cn(
          isDarkTheme 
            ? "bg-gray-700 text-white border border-gray-500" 
            : "bg-gray-100 text-gray-900 border border-gray-300"
        ),
        day_outside: cn(
          isDarkTheme ? "text-gray-500 opacity-50" : "text-gray-400 opacity-50"
        ),
        day_disabled: cn(
          isDarkTheme ? "text-gray-600 opacity-50" : "text-gray-300 opacity-50"
        ),
        day_range_middle: cn(
          isDarkTheme 
            ? "aria-selected:bg-gray-700 aria-selected:text-white" 
            : "aria-selected:bg-blue-50 aria-selected:text-gray-900"
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
