import { useState } from "react";
import { CalendarEvent } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { addHours } from "date-fns";
import { CalendarViewType } from "@/lib/types/calendar";

export const useEventDialog = (
  createEvent: (data: Partial<CalendarEvent>) => Promise<void>,
  updateEvent: (params: { id: string; updates: Partial<CalendarEvent> }) => Promise<void>,
  deleteEvent: (id: string) => Promise<void>
) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date } | null>(null);
  const { toast } = useToast();

  const handleDayClick = (date: Date, hour?: number, view?: CalendarViewType) => {
    const clickedDate = new Date(date);
    
    if (view === "month") {
      // For month view, set a default time (9 AM)
      clickedDate.setHours(9, 0, 0, 0);
    } else if (hour !== undefined) {
      // For week/day view, use the exact clicked hour
      clickedDate.setHours(hour, 0, 0, 0);
    }
    
    setSelectedSlot({ date: clickedDate });
    setSelectedEvent(null);
    setIsNewEventDialogOpen(true);
  };

  const handleCreateEvent = async (data: Partial<CalendarEvent>) => {
    try {
      await createEvent(data);
      setIsNewEventDialogOpen(false);
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateEvent = async (updates: Partial<CalendarEvent>) => {
    if (!selectedEvent) return;
    
    try {
      await updateEvent({
        id: selectedEvent.id,
        updates,
      });
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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