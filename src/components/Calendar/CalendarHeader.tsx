import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface CalendarHeaderProps {
  selectedDate: Date;
  view: "month" | "week" | "day";
  onViewChange: (view: "month" | "week" | "day") => void;
  onPrevious: () => void;
  onNext: () => void;
  onAddEvent: () => void;
}

export const CalendarHeader = ({
  selectedDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onAddEvent,
}: CalendarHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
        <Button variant="outline" size="icon" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg sm:text-xl font-semibold">
          {format(selectedDate, "MMMM yyyy")}
        </h2>
        <Button variant="outline" size="icon" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex rounded-lg border border-input overflow-hidden flex-1 sm:flex-none">
          {["month", "week", "day"].map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              className="rounded-none px-2 sm:px-4 text-sm flex-1"
              onClick={() => onViewChange(v as "month" | "week" | "day")}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
        <Button onClick={onAddEvent} className="whitespace-nowrap">Add Event</Button>
      </div>
    </div>
  );
};