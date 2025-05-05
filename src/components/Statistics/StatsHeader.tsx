
import { Button } from "../ui/button";
import { FileSpreadsheet } from "lucide-react";
import { DateRangeSelect } from "./DateRangeSelect";
import { memo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { LanguageText } from "../shared/LanguageText";

interface StatsHeaderProps {
  dateRange: { start: Date; end: Date };
  onDateChange: (start: Date, end: Date | null) => void;
  onExport: () => void;
  isLoading?: boolean;
}

export const StatsHeader = memo(({ dateRange, onDateChange, onExport, isLoading }: StatsHeaderProps) => {
  // Wrapped in useCallback to ensure stable reference
  const handleDateChange = useCallback((start: Date, end: Date | null) => {
    onDateChange(start, end || start);
  }, [onDateChange]);

  const { language } = useLanguage();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
      <DateRangeSelect 
        selectedDate={dateRange}
        onDateChange={handleDateChange}
        disabled={isLoading}
      />
      <Button
        variant="info"
        size="icon"
        onClick={onExport}
        className="h-9 w-9 sm:-mt-4 rounded-md"
        title="Download as Excel"
        disabled={isLoading}
      >
        <FileSpreadsheet className="h-5 w-5" />
      </Button>
    </div>
  );
});

StatsHeader.displayName = 'StatsHeader';
