
import { useState } from "react";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TaskDateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder: string;
  disabled?: boolean;
}

export const TaskDateTimePicker = ({ value, onChange, placeholder, disabled }: TaskDateTimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [selectedHour, setSelectedHour] = useState<string>(value ? format(value, "HH") : "09");
  const [selectedMinute, setSelectedMinute] = useState<string>(value ? format(value, "mm") : "00");

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const newDateTime = new Date(date);
      newDateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute));
      onChange(newDateTime);
    }
  };

  const handleTimeChange = (hour: string, minute: string) => {
    if (selectedDate) {
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(parseInt(hour), parseInt(minute));
      onChange(newDateTime);
    }
    setSelectedHour(hour);
    setSelectedMinute(minute);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP 'at' HH:mm") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
            className="pointer-events-auto"
          />
          <div className="flex items-center space-x-2">
            <Select value={selectedHour} onValueChange={(hour) => handleTimeChange(hour, selectedMinute)}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent>
                {hours.map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>:</span>
            <Select value={selectedMinute} onValueChange={(minute) => handleTimeChange(selectedHour, minute)}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent>
                {minutes.map((minute) => (
                  <SelectItem key={minute} value={minute}>
                    {minute}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setIsOpen(false)} size="sm">
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
