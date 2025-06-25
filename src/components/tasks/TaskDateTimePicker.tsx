
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getUserTimezone } from "@/utils/timezoneUtils";
import { useTimezoneValidation } from "@/hooks/useTimezoneValidation";
import { useToast } from "@/components/ui/use-toast";

interface TaskDateTimePickerProps {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  type?: 'deadline' | 'reminder';
  deadlineValue?: string; // for reminder validation
}

export const TaskDateTimePicker = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'deadline',
  deadlineValue
}: TaskDateTimePickerProps) => {
  const { toast } = useToast();
  const { validateDateTime, isValidating } = useTimezoneValidation();
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
  const [currentTime, setCurrentTime] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("");

  useEffect(() => {
    const tz = getUserTimezone();
    setTimezone(tz);
    
    const updateCurrentTime = () => {
      // Get current time and format it properly in user's timezone
      const now = new Date();
      const timeString = now.toLocaleString("en-US", {
        timeZone: tz,
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      
      setCurrentTime(timeString);
      
      console.log('Current time update:', {
        timezone: tz,
        utcTime: now.toISOString(),
        formattedTime: timeString
      });
    };
    
    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  const handleDateTimeChange = async () => {
    if (selectedDate) {
      const dateTime = new Date(selectedDate);
      dateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute));
      const isoString = dateTime.toISOString();
      
      // Validate the selected datetime
      const validationResult = await validateDateTime(
        isoString, 
        type,
        deadlineValue
      );
      
      if (!validationResult.valid) {
        toast({
          title: "Invalid Time",
          description: validationResult.message,
          variant: "destructive",
        });
        return;
      }
      
      onChange(isoString);
      setIsOpen(false);
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    setSelectedDate(undefined);
  };

  const handleQuickSet = () => {
    // Get current time and add 1 hour
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    setSelectedDate(oneHourLater);
    setSelectedHour(format(oneHourLater, "HH"));
    setSelectedMinute(format(oneHourLater, "mm"));
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
              {/* Current time display */}
              <div className="mb-3 p-2 bg-muted rounded-md">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Current time: {currentTime}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Timezone: {timezone}
                </div>
              </div>
              
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
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
                <Button 
                  onClick={handleDateTimeChange} 
                  disabled={!selectedDate || isValidating}
                  size="sm"
                >
                  {isValidating ? "Validating..." : "Set"}
                </Button>
              </div>
              
              {/* Quick set button */}
              <div className="mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleQuickSet}
                  className="w-full text-xs"
                >
                  Set for 1 hour from now
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
