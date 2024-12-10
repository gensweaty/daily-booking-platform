import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";

export const useEventDialog = (
  createEvent: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>,
  updateEvent: (params: { id: string; updates: Partial<CalendarEventType> }) => Promise<CalendarEventType>,
  deleteEvent: (id: string) => Promise<void>
) => {
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

  const handleCreateEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      const newEvent = await createEvent(data);
      setIsNewEventDialogOpen(false);
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      return newEvent;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateEvent = async (updates: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!selectedEvent) throw new Error("No event selected");
    
    try {
      const updatedEvent = await updateEvent({
        id: selectedEvent.id,
        updates,
      });
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      return updatedEvent;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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