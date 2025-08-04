
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, ChevronUp, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventReminderFieldsProps {
  reminderAt: Date | null;
  setReminderAt: (date: Date | null) => void;
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (enabled: boolean) => void;
}

export const EventReminderFields = ({
  reminderAt,
  setReminderAt,
  emailReminderEnabled,
  setEmailReminderEnabled,
}: EventReminderFieldsProps) => {
  const { t } = useLanguage();
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  // Generate time options for hours selection grid - full 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return { value: hour, label: hour };
  });

  // Generate time options for minutes selection grid - all 60 minutes
  const minutes = Array.from({ length: 60 }, (_, i) => {
    const minute = i.toString().padStart(2, '0');
    return { value: minute, label: minute };
  });

  const formatDateDisplay = (date: Date) => {
    return format(date, 'MM/dd/yyyy HH:mm');
  };

  const handleReminderToggle = (checked: boolean) => {
    if (checked && !reminderAt) {
      // Set default reminder to 1 hour before start time
      const defaultReminder = new Date();
      defaultReminder.setHours(defaultReminder.getHours() + 1);
      setReminderAt(defaultReminder);
    } else if (!checked) {
      setReminderAt(null);
      setEmailReminderEnabled(false);
    }
  };

  // Auto-disable email reminder when reminder is turned off
  useEffect(() => {
    if (!reminderAt) {
      setEmailReminderEnabled(false);
    }
  }, [reminderAt, setEmailReminderEnabled]);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="reminder"
          checked={!!reminderAt}
          onCheckedChange={handleReminderToggle}
        />
        <Label htmlFor="reminder" className="text-sm font-medium">
          {t("events.setReminder")}
        </Label>
      </div>

      {reminderAt && (
        <div className="space-y-3 ml-6">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              {t("events.reminderTime")}
            </Label>
            <Popover open={isReminderOpen} onOpenChange={setIsReminderOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-left font-normal"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {formatDateDisplay(reminderAt)}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0 bg-background" 
                align="start"
                sideOffset={4}
              >
                <div className="flex">
                  <div className="border-r">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted">
                      <h4 className="font-medium text-sm">
                        {format(reminderAt, 'MMMM yyyy')}
                      </h4>
                      <div className="flex items-center space-x-1">
                        <Button variant="outline" size="icon" className="h-7 w-7 bg-background">
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7 bg-background">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Calendar
                      mode="single"
                      selected={reminderAt}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date);
                          newDate.setHours(reminderAt.getHours(), reminderAt.getMinutes());
                          setReminderAt(newDate);
                        }
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </div>
                  <div className="flex">
                    <div className="grid auto-rows-max overflow-hidden">
                      <ScrollArea className="h-72 w-16">
                        <div className="flex flex-col items-center">
                          {hours.map((hour) => (
                            <div
                              key={hour.value}
                              className={cn(
                                "flex items-center justify-center text-center h-10 w-full cursor-pointer hover:bg-muted",
                                reminderAt.getHours() === parseInt(hour.value) && "bg-primary text-primary-foreground"
                              )}
                              onClick={() => {
                                const newDate = new Date(reminderAt);
                                newDate.setHours(parseInt(hour.value));
                                setReminderAt(newDate);
                              }}
                            >
                              {hour.label}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                    <div className="grid auto-rows-max overflow-hidden">
                      <ScrollArea className="h-72 w-16">
                        <div className="flex flex-col items-center">
                          {minutes.map((minute) => (
                            <div
                              key={minute.value}
                              className={cn(
                                "flex items-center justify-center text-center h-10 w-full cursor-pointer hover:bg-muted",
                                reminderAt.getMinutes() === parseInt(minute.value) && "bg-primary text-primary-foreground"
                              )}
                              onClick={() => {
                                const newDate = new Date(reminderAt);
                                newDate.setMinutes(parseInt(minute.value));
                                setReminderAt(newDate);
                              }}
                            >
                              {minute.label}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="email-reminder"
              checked={emailReminderEnabled}
              onCheckedChange={setEmailReminderEnabled}
            />
            <Label htmlFor="email-reminder" className="text-sm font-medium">
              {t("events.sendEmailReminder")}
            </Label>
          </div>
        </div>
      )}
    </div>
  );
};
