import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

interface DateRangeSelectProps {
  selectedRange: number;
  onRangeChange: (months: number) => void;
}

export const DateRangeSelect = ({ selectedRange, onRangeChange }: DateRangeSelectProps) => {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Select value={selectedRange.toString()} onValueChange={(value) => onRangeChange(parseInt(value))}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3">Last 3 months</SelectItem>
          <SelectItem value="6">Last 6 months</SelectItem>
          <SelectItem value="12">Last 12 months</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};