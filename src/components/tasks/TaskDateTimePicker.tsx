
import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TaskDateTimePickerProps {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  minDate?: Date;
}

export const TaskDateTimePicker = ({
  label,
  value,
  onChange,
  placeholder,
  minDate
}: TaskDateTimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [selectedHour, setSelectedHour] = useState<string>(
    value ? format(new Date(value), "HH") : "09"
  );
  const [selectedMinute, setSelectedMinute] = useState<string>(
    value ? format(new Date(value), "mm") : "00"
  );

  const handleDateTimeChange = () => {
    if (selectedDate) {
      const dateTime = new Date(selectedDate);
      dateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute));
      onChange(dateTime.toISOString());
      setIsOpen(false);
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    setSelectedDate(undefined);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className="space-y-2">
      {!value ? (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => minDate && date < minDate}
                initialFocus
                className="pointer-events-auto"
              />
              <div className="flex gap-2 mt-3">
                <Select value={selectedHour} onValueChange={setSelectedHour}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map((minute) => (
                      <SelectItem key={minute} value={minute}>
                        {minute}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleDateTimeChange} disabled={!selectedDate}>
                  Set
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {label}: {format(new Date(value), "MMM dd, yyyy 'at' HH:mm")}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
