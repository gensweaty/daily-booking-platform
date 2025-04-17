
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, memo } from "react";
import { DateRange } from "react-day-picker";

interface DateRangeSelectProps {
  selectedDate: {
    start: Date;
    end: Date;
  };
  onDateChange: (start: Date, end: Date | null) => void;
  disabled?: boolean;
}

export const DateRangeSelect = memo(({ selectedDate, onDateChange, disabled }: DateRangeSelectProps) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: selectedDate.start,
    to: selectedDate.end,
  });

  return (
    <div className="flex items-center gap-2 mb-4 w-full sm:w-auto">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full sm:w-[280px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={selectedDate.start}
            selected={date}
            onSelect={(newDate) => {
              setDate(newDate);
              if (newDate?.from) {
                onDateChange(newDate.from, newDate?.to || null);
                setOpen(false);
              }
            }}
            numberOfMonths={2}
            className="bg-background border rounded-md shadow-md pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
});

DateRangeSelect.displayName = 'DateRangeSelect';
