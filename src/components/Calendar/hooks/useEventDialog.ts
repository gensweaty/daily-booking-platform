
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
      
      // Make sure business_id is properly set and not an empty string
      if (typeof cleanData.business_id === 'string' && cleanData.business_id.trim() === '') {
        console.log("Business ID is empty string, removing it");
        delete cleanData.business_id;
      } 
      
      // FIX: CRITICAL - Throw error if business_id is missing
      if (!cleanData.business_id) {
        console.error("Business ID is required for event creation");
        throw new Error("Business ID is required to create an event");
      }
      
      console.log('handleCreateEvent - Business ID in event data:', cleanData.business_id);
      console.log('handleCreateEvent - Data for submission:', JSON.stringify(cleanData));
      
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
      
      // Ensure the ID is included for the update operation
      cleanData.id = selectedEvent.id;
      
      // Make sure business_id is properly set and not an empty string
      if (typeof cleanData.business_id === 'string' && cleanData.business_id.trim() === '') {
        console.log("Business ID is empty string, removing it");
        delete cleanData.business_id;
      } 
      
      // FIX: CRITICAL - Ensure business_id is set properly for updates
      if (!cleanData.business_id) {
        // Preserve the existing business_id if it's not being explicitly updated
        if (selectedEvent.business_id) {
          cleanData.business_id = selectedEvent.business_id;
          console.log("Preserving existing business_id:", selectedEvent.business_id);
        } else {
          console.error("Business ID is required for event updates");
          throw new Error("Business ID is required to update an event");
        }
      }
      
      console.log("Updating event with data:", JSON.stringify(cleanData));
      
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
