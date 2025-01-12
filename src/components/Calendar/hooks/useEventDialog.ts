import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { isWithinInterval, parseISO } from "date-fns";

interface UseEventDialogProps {
  createEvent: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent: (id: string) => Promise<void>;
}

export const useEventDialog = ({
  createEvent,
  updateEvent,
  deleteEvent,
}: UseEventDialogProps) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date } | null>(null);
  const { toast } = useToast();

  const handleDayClick = (date: Date, hour?: number, view?: "month" | "week" | "day") => {
    const clickedDate = new Date(date);
    
    if (hour !== undefined) {
      clickedDate.setHours(hour, 0, 0, 0);
    } else if (view === "month") {
      clickedDate.setHours(9, 0, 0, 0);
    }
    
    setSelectedSlot({ date: clickedDate });
    setSelectedEvent(null);
    setIsNewEventDialogOpen(true);
  };

  const checkTimeSlotAvailability = (
    startDate: Date,
    endDate: Date,
    existingEvents: CalendarEventType[],
    excludeEventId?: string
  ): { available: boolean; conflictingEvent?: CalendarEventType } => {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const conflictingEvent = existingEvents.find((event) => {
      if (excludeEventId && event.id === excludeEventId) return false;
      
      const eventStart = parseISO(event.start_date).getTime();
      const eventEnd = parseISO(event.end_date).getTime();

      // Allow events to start exactly when another ends
      if (startTime === eventEnd || endTime === eventStart) {
        return false;
      }

      // Check for any overlap
      return (
        (startTime < eventEnd && endTime > eventStart) ||
        (startTime === eventStart && endTime === eventEnd)
      );
    });

    return {
      available: !conflictingEvent,
      conflictingEvent,
    };
  };

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      // Get all events from the Calendar component's events prop
      const allEvents = (window as any).__CALENDAR_EVENTS__ || [];
      
      const startDate = new Date(data.start_date as string);
      const endDate = new Date(data.end_date as string);

      const { available, conflictingEvent } = checkTimeSlotAvailability(
        startDate,
        endDate,
        allEvents
      );

      if (!available && conflictingEvent) {
        toast({
          title: "Time Slot Unavailable",
          description: `This time slot conflicts with "${conflictingEvent.title}" (${new Date(conflictingEvent.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent.end_date).toLocaleTimeString()})`,
          variant: "destructive",
        });
        throw new Error("Time slot conflict");
      }

      const result = await createEvent(data);
      setIsNewEventDialogOpen(false);
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      return result;
    } catch (error: any) {
      if (error.message !== "Time slot conflict") {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const handleUpdateEvent = async (updates: Partial<CalendarEventType>) => {
    if (!selectedEvent) return;
    
    try {
      // Get all events from the Calendar component's events prop
      const allEvents = (window as any).__CALENDAR_EVENTS__ || [];
      
      const startDate = new Date(updates.start_date as string);
      const endDate = new Date(updates.end_date as string);

      const { available, conflictingEvent } = checkTimeSlotAvailability(
        startDate,
        endDate,
        allEvents,
        selectedEvent.id // Exclude the current event from the check
      );

      if (!available && conflictingEvent) {
        toast({
          title: "Time Slot Unavailable",
          description: `This time slot conflicts with "${conflictingEvent.title}" (${new Date(conflictingEvent.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent.end_date).toLocaleTimeString()})`,
          variant: "destructive",
        });
        throw new Error("Time slot conflict");
      }

      const result = await updateEvent(updates);
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      return result;
    } catch (error: any) {
      if (error.message !== "Time slot conflict") {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    
    try {
      await deleteEvent(selectedEvent.id);
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedSlot,
    setSelectedSlot,
    handleDayClick,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  };
};