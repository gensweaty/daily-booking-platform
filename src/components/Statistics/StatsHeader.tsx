
import { Button } from "../ui/button";
import { FileSpreadsheet } from "lucide-react";
import { DateRangeSelect } from "./DateRangeSelect";
import { memo, useCallback } from "react";

interface StatsHeaderProps {
  dateRange: { start: Date; end: Date };
  onDateChange: (start: Date, end: Date | null) => void;
  onExport: () => void;
}

export const StatsHeader = memo(({ dateRange, onDateChange, onExport }: StatsHeaderProps) => {
  // Wrapped in useCallback to ensure stable reference
  const handleDateChange = useCallback((start: Date, end: Date | null) => {
    onDateChange(start, end || start);
  }, [onDateChange]);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
      <DateRangeSelect 
        selectedDate={dateRange}
        onDateChange={handleDateChange}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onExport}
        className="h-9 w-9 sm:-mt-4"
        title="Download as Excel"
      >
        <FileSpreadsheet className="h-5 w-5" />
      </Button>
    </div>
  );
});

StatsHeader.displayName = 'StatsHeader';
