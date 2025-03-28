
import { useState, useEffect } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedEvent) {
      setSelectedDate(new Date(selectedEvent.start_date));
    }
  }, [selectedEvent]);

  useEffect(() => {
    console.log('useEventDialog - selectedDate changed:', selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    console.log('useEventDialog - dialog open state changed:', isNewEventDialogOpen);
    console.log('useEventDialog - current selectedDate:', selectedDate);
  }, [isNewEventDialogOpen]);

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      console.log('handleCreateEvent - Received data:', data);
      
      const startDate = new Date(data.start_date as string);
      const endDate = new Date(data.end_date as string);

      console.log('handleCreateEvent - Parsed dates:', {
        start: startDate,
        end: endDate
      });

      // Create a clean copy of the data to avoid modifying the original
      const cleanData = { ...data };
      
      // Only include business_id if it's explicitly provided and not null/undefined
      if (cleanData.business_id === null || cleanData.business_id === undefined) {
        delete cleanData.business_id;
      } else {
        console.log("Business ID included in event data:", cleanData.business_id);
      }

      console.log('handleCreateEvent - Data for submission:', cleanData);
      const result = await createEvent(cleanData);
      
      setIsNewEventDialogOpen(false);
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      return result;
    } catch (error: any) {
      console.error('handleCreateEvent - Error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateEvent = async (data: Partial<CalendarEventType>) => {
    if (!selectedEvent) return;
    
    try {
      // Create a clean copy of the data to avoid modifying the original
      const cleanData = { ...data };
      
      // Only include business_id if it's explicitly provided and not null/undefined
      if (cleanData.business_id === null || cleanData.business_id === undefined) {
        delete cleanData.business_id;
      } else {
        console.log("Business ID included in update data:", cleanData.business_id);
      }

      // Preserve the existing business_id if it's not being explicitly updated
      if (selectedEvent.business_id && !cleanData.hasOwnProperty('business_id')) {
        cleanData.business_id = selectedEvent.business_id;
      }
      
      // Fixed: Pass the id directly in the cleanData instead of using a nested updates object
      cleanData.id = selectedEvent.id;
      const result = await updateEvent(cleanData);
      
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      return result;
    } catch (error: any) {
      console.error('handleUpdateEvent - Error:', error);
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
      console.error('handleDeleteEvent - Error:', error);
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
    selectedDate,
    setSelectedDate,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  };
};
