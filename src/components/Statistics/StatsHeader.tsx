
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
        variant="outline"
        className="h-10 w-10 flex items-center justify-center"
        onClick={onExport}
        title="Export to Excel"
      >
        <FileSpreadsheet className="h-4 w-4" />
      </Button>
    </div>
  );
};
