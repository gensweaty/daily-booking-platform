
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
}

export const DateTimePicker = ({ value, onChange, placeholder = "Pick a date and time" }: DateTimePickerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [hour, setHour] = useState<string>(value ? format(value, 'HH') : '09');
  const [minute, setMinute] = useState<string>(value ? format(value, 'mm') : '00');

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const newDateTime = new Date(date);
      newDateTime.setHours(parseInt(hour), parseInt(minute));
      onChange(newDateTime);
    } else {
      onChange(undefined);
    }
  };

  const handleTimeChange = (newHour?: string, newMinute?: string) => {
    const h = newHour || hour;
    const m = newMinute || minute;
    setHour(h);
    setMinute(m);
    
    if (selectedDate) {
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(parseInt(h), parseInt(m));
      onChange(newDateTime);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP 'at' HH:mm") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          initialFocus
          className="pointer-events-auto"
        />
        <div className="p-3 border-t border-border">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <Select value={hour} onValueChange={(value) => handleTimeChange(value, undefined)}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hours.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>:</span>
            <Select value={minute} onValueChange={(value) => handleTimeChange(undefined, value)}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {minutes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
