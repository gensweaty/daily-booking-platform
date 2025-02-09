
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
        className="h-10 w-10 flex items-center justify-center -mt-4"
        onClick={onExport}
        title="Export to Excel"
      >
        <FileSpreadsheet className="h-10 w-10" />
      </Button>
    </div>
  );
};

