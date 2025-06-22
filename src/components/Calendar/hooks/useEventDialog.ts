
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";

interface UseEventDialogProps {
  createEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent?: (id: string, deleteChoice?: 'this' | 'series') => Promise<void>;
}

export const useEventDialog = ({
  createEvent,
  updateEvent,
  deleteEvent,
}: UseEventDialogProps) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      const eventData = {
        ...data,
        type: 'event',
        title: data.user_surname || data.title,
        user_surname: data.user_surname || data.title,
        payment_status: normalizePaymentStatus(data.payment_status) || 'not_paid',
        checkAvailability: false,
        language: data.language || language || 'en'
      };
      
      console.log("Creating event with language:", eventData.language);
      
      if (!createEvent) throw new Error("Create event function not provided");
      
      console.log("Creating event with data:", eventData);
      const createdEvent = await createEvent(eventData);
      
      setIsNewEventDialogOpen(false);
      console.log("Event created successfully:", createdEvent);
      
      // Refresh queries after creation
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      
      return createdEvent;
    } catch (error: any) {
      console.error("Failed to create event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      if (!updateEvent || !selectedEvent) {
        throw new Error("Update event function not provided or no event selected");
      }
      
      const eventData = {
        ...data,
        type: selectedEvent.type || 'event',
        title: data.user_surname || data.title || selectedEvent.title,
        user_surname: data.user_surname || data.title || selectedEvent.user_surname,
        payment_status: normalizePaymentStatus(data.payment_status) || normalizePaymentStatus(selectedEvent.payment_status) || 'not_paid',
        language: data.language || selectedEvent.language || language || 'en'
      };
      
      console.log("Updating event with language:", eventData.language);
      
      console.log("Updating event with data:", eventData);
      
      const { checkAvailability, ...dataToSend } = eventData as any;
      const updatedEvent = await updateEvent(dataToSend);
      
      setSelectedEvent(null);
      console.log("Event updated successfully:", updatedEvent);
      
      // Refresh queries after update
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      
      return updatedEvent;
    } catch (error: any) {
      console.error("Failed to update event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Updated delete handler to properly accept and pass parameters
  const handleDeleteEvent = async (eventId: string, deleteChoice?: 'this' | 'series') => {
    try {
      if (!deleteEvent) {
        throw new Error("Delete event function not provided");
      }
      
      console.log("useEventDialog: handleDeleteEvent called with:", { eventId, deleteChoice });
      
      // Handle virtual instances for 'this' choice
      if (eventId.includes('-') && deleteChoice === 'this') {
        console.log("Virtual instance deletion - triggering UI refresh only");
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['business-events'] });
        
        toast({
          title: "Success",
          description: "Recurring instance removed from view",
          variant: "default",
        });
        
        setSelectedEvent(null);
        return;
      }
      
      // Call the actual delete function with proper parameters
      await deleteEvent(eventId, deleteChoice);
      
      setSelectedEvent(null);
      console.log("Event deleted successfully:", eventId);
      
      // Always refresh queries after deletion
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      
      toast({
        title: "Success",
        description: "Event deleted successfully",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Helper function to normalize payment status values
  const normalizePaymentStatus = (status: string | undefined): string | undefined => {
    if (!status) return undefined;
    
    console.log("Normalizing payment status:", status);
    
    if (status.includes('partly')) return 'partly_paid';
    if (status.includes('fully')) return 'fully_paid';
    if (status.includes('not_paid') || status === 'not paid') return 'not_paid';
    
    return status;
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
