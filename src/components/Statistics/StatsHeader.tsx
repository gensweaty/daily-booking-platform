
import { Button } from "../ui/button";
import { FileSpreadsheet } from "lucide-react";
import { DateRangeSelect } from "./DateRangeSelect";

interface StatsHeaderProps {
  dateRange: { start: Date; end: Date };
  onDateChange: (start: Date, end: Date | null) => void;
  onExport: () => void;
}

export const StatsHeader = ({ dateRange, onDateChange, onExport }: StatsHeaderProps) => {
  return (
    <div className="flex items-center gap-2 mb-4">
      <DateRangeSelect 
        selectedDate={dateRange}
        onDateChange={(start, end) => onDateChange(start, end || start)}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onExport}
        className="h-9 w-9"
        title="Download as Excel"
      >
        <FileSpreadsheet className="h-5 w-5" />
      </Button>
    </div>
  );
};

