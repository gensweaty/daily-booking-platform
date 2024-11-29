import { useState } from "react";
import { CalendarEvent } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { addHours, setHours } from "date-fns";
import { CalendarViewType } from "@/lib/types/calendar";

export const useEventDialog = (
  createEvent: (data: Partial<CalendarEvent>) => Promise<void>,
  updateEvent: (params: { id: string; updates: Partial<CalendarEvent> }) => Promise<void>,
  deleteEvent: (id: string) => Promise<void>
) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour?: number } | null>(null);
  const { toast } = useToast();

  const handleDayClick = (date: Date, hour: number | undefined, view: CalendarViewType) => {
    let startDate = date;
    
    if (hour !== undefined) {
      startDate = setHours(date, hour);
    } else if (view === "month") {
      startDate = setHours(date, 12);
    } else {
      startDate = setHours(date, new Date().getHours());
    }

    startDate = new Date(startDate.setMinutes(0));
    
    setSelectedSlot({ 
      date: startDate,
      hour: hour
    });
    setSelectedEvent(null);
    setIsNewEventDialogOpen(true);
  };

  const handleCreateEvent = async (data: Partial<CalendarEvent>) => {
    try {
      const eventData = {
        ...data,
        start_date: data.start_date,
        end_date: data.end_date
      };
      
      await createEvent(eventData);
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
      const eventUpdates = {
        ...updates,
        start_date: updates.start_date,
        end_date: updates.end_date
      };
      
      await updateEvent({
        id: selectedEvent.id,
        updates: eventUpdates,
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