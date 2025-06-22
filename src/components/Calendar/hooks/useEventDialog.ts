
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";

interface UseEventDialogProps {
  createEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent?: (id: string, deleteChoice?: 'this' | 'series') => Promise<{ success: boolean }>;
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
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['business-events'] });
      
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
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['business-events'] });
      
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

  // Simplified delete handler that properly propagates errors
  const handleDeleteEvent = async (eventId: string, deleteChoice?: 'this' | 'series'): Promise<{ success: boolean }> => {
    try {
      if (!deleteEvent) {
        throw new Error("Delete event function not provided");
      }
      
      if (!eventId) {
        throw new Error("No event ID provided");
      }
      
      console.log("=== USEVENTDIALOG DELETE START ===");
      console.log("Event ID:", eventId);
      console.log("Delete choice:", deleteChoice);
      
      // Call the delete function and wait for result
      const result = await deleteEvent(eventId, deleteChoice);
      
      console.log("Delete result:", result);
      
      // Clear selected event
      setSelectedEvent(null);
      
      // Show success message
      toast({
        title: "Success",
        description: "Event deleted successfully",
        variant: "default",
      });
      
      console.log("=== USEVENTDIALOG DELETE COMPLETED ===");
      return { success: true };
      
    } catch (error: any) {
      console.error("=== USEVENTDIALOG DELETE FAILED ===", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
      return { success: false };
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
