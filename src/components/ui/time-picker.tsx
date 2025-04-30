
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
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<"AM" | "PM">("AM");
  const [selectedHour, setSelectedHour] = useState<string>("09");
  const [selectedMinute, setSelectedMinute] = useState<string>("00");

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

    // Parse current time if provided
    if (current) {
      const [hours, minutes] = current.split(':').map(Number);
      const hour = hours % 12 || 12;
      const period = hours >= 12 ? "PM" : "AM";
      
      setSelectedHour(hour.toString().padStart(2, '0'));
      setSelectedMinute(minutes.toString().padStart(2, '0'));
      setSelectedTimePeriod(period as "AM" | "PM");
    }
  }, [interval, from, to, current]);

  const handleTimeChange = () => {
    let hour = parseInt(selectedHour);
    if (selectedTimePeriod === "PM" && hour !== 12) {
      hour += 12;
    } else if (selectedTimePeriod === "AM" && hour === 12) {
      hour = 0;
    }
    
    const formattedHour = hour.toString().padStart(2, '0');
    const timeString = `${formattedHour}:${selectedMinute}`;
    setTime(timeString);
  };

  useEffect(() => {
    handleTimeChange();
  }, [selectedHour, selectedMinute, selectedTimePeriod]);

  const hours = Array.from({ length: 12 }, (_, i) => {
    const hour = (i + 1).toString().padStart(2, '0');
    return hour;
  });

  const minutes = ["00", "15", "30", "45"];

  return (
    <div className="bg-background border rounded-md shadow-md p-1 w-auto">
      <div className="flex">
        <div className="flex-1 border-r min-w-16">
          <ScrollArea className="h-48 w-full">
            <div className="flex flex-col items-center">
              {hours.map((hour) => (
                <Button
                  key={hour}
                  variant={selectedHour === hour ? "default" : "ghost"}
                  className={`py-1 w-full rounded-sm ${
                    selectedHour === hour ? "bg-primary text-primary-foreground" : ""
                  }`}
                  onClick={() => setSelectedHour(hour)}
                >
                  {hour}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        <div className="flex-1 border-r min-w-16">
          <ScrollArea className="h-48 w-full">
            <div className="flex flex-col items-center">
              {minutes.map((minute) => (
                <Button
                  key={minute}
                  variant={selectedMinute === minute ? "default" : "ghost"}
                  className={`py-1 w-full rounded-sm ${
                    selectedMinute === minute ? "bg-primary text-primary-foreground" : ""
                  }`}
                  onClick={() => setSelectedMinute(minute)}
                >
                  {minute}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        <div className="flex-1 min-w-16">
          <div className="flex flex-col h-full">
            <Button
              variant={selectedTimePeriod === "AM" ? "default" : "ghost"}
              className={`py-1 flex-1 rounded-sm ${
                selectedTimePeriod === "AM" ? "bg-primary text-primary-foreground" : ""
              }`}
              onClick={() => setSelectedTimePeriod("AM")}
            >
              AM
            </Button>
            <Button
              variant={selectedTimePeriod === "PM" ? "default" : "ghost"}
              className={`py-1 flex-1 rounded-sm ${
                selectedTimePeriod === "PM" ? "bg-primary text-primary-foreground" : ""
              }`}
              onClick={() => setSelectedTimePeriod("PM")}
            >
              PM
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
