import { useState, useEffect } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";

export const useEventDialog = () => {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [event, setEvent] = useState<CalendarEventType | undefined>(undefined);

  const { handleSubmitEvent, checkTimeSlotAvailability } = useCalendarEvents();
  const { toast } = useToast();

  const onOpenChange = (open: boolean) => {
    setOpen(open);
  };

  const handleCreateEvent = async (eventData: Partial<CalendarEventType>) => {
    try {
      await handleSubmitEvent(eventData);
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEvent = async (eventData: Partial<CalendarEventType>) => {
    try {
      // No need to check conflicts here - that's now handled in handleSubmitEvent
      await handleSubmitEvent(eventData);
      
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      // await deleteEvent(eventId);
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  return {
    open,
    onOpenChange,
    selectedDate,
    setSelectedDate,
    event,
    setEvent,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    checkTimeSlotAvailability,
  };
};
