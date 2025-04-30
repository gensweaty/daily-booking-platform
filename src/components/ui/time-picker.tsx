
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";

interface TimePickerProps {
  setTime: (time: string) => void;
  current?: string;
  interval?: number;
  from?: string;
  to?: string;
}

export const TimePicker = ({
  setTime,
  current,
  interval = 30,
  from = "00:00",
  to = "23:59",
}: TimePickerProps) => {
  const [times, setTimes] = useState<string[]>([]);

  useEffect(() => {
    // Generate time slots based on interval
    const generateTimeSlots = () => {
      const slots: string[] = [];
      
      // Convert from and to to minutes
      const [fromHour, fromMinute] = from.split(":").map(Number);
      const [toHour, toMinute] = to.split(":").map(Number);
      
      const startMinutes = fromHour * 60 + fromMinute;
      const endMinutes = toHour * 60 + toMinute;
      
      for (let i = startMinutes; i <= endMinutes; i += interval) {
        const hour = Math.floor(i / 60);
        const minute = i % 60;
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
      
      return slots;
    };
    
    setTimes(generateTimeSlots());
  }, [interval, from, to]);

  const handleTimeSelect = (time: string) => {
    setTime(time);
  };

  return (
    <ScrollArea className="h-72 w-48 rounded-md border">
      <div className="p-2">
        {times.map((time) => (
          <Button
            key={time}
            variant="ghost"
            className="flex w-full justify-between items-center px-4 py-2"
            onClick={() => handleTimeSelect(time)}
          >
            <span>{time}</span>
            {current === time && <Check className="h-4 w-4" />}
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
};
