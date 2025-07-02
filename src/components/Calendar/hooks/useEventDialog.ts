
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface UseEventDialogProps {
  createEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent?: ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => Promise<{ success: boolean; }>;
}

export const useEventDialog = ({
  createEvent,
  updateEvent,
  deleteEvent,
}: UseEventDialogProps) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [deleteChoice, setDeleteChoice] = useState<"this" | "series">("this");
  const { toast } = useToast();
  const { language } = useLanguage();

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      // Ensure title is never empty - use user_surname as fallback
      const eventTitle = data.title?.trim() || data.user_surname?.trim() || "Untitled Event";
      
      const eventData = {
        ...data,
        type: 'event',
        title: eventTitle,
        user_surname: data.user_surname || eventTitle,
        payment_status: normalizePaymentStatus(data.payment_status) || 'not_paid',
        checkAvailability: false,
        language: data.language || language || 'en',
        // Ensure recurring fields are properly set
        is_recurring: data.is_recurring || false,
        repeat_pattern: data.is_recurring ? data.repeat_pattern : null,
        repeat_until: data.is_recurring && data.repeat_until ? data.repeat_until : null
      };
      
      console.log("Creating event with language:", eventData.language);
      console.log("Creating recurring event:", {
        is_recurring: eventData.is_recurring,
        repeat_pattern: eventData.repeat_pattern,
        repeat_until: eventData.repeat_until
      });
      
      if (!createEvent) throw new Error("Create event function not provided");
      
      console.log("Creating event with data:", eventData);
      const createdEvent = await createEvent(eventData);
      
      setIsNewEventDialogOpen(false);
      console.log("Event created successfully:", createdEvent);
      
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
      
      // Ensure title is never empty - use user_surname as fallback
      const eventTitle = data.title?.trim() || data.user_surname?.trim() || selectedEvent.title || "Untitled Event";
      
      const eventData = {
        ...data,
        type: selectedEvent.type || 'event',
        title: eventTitle,
        user_surname: data.user_surname || eventTitle,
        payment_status: normalizePaymentStatus(data.payment_status) || normalizePaymentStatus(selectedEvent.payment_status) || 'not_paid',
        language: data.language || selectedEvent.language || language || 'en',
        // Ensure recurring fields are properly handled
        is_recurring: data.is_recurring !== undefined ? data.is_recurring : selectedEvent.is_recurring,
        repeat_pattern: data.is_recurring ? data.repeat_pattern : null,
        repeat_until: data.is_recurring && data.repeat_until ? data.repeat_until : null
      };
      
      console.log("Updating event with language:", eventData.language);
      console.log("Updating event with data:", eventData);
      
      const updatedEvent = await updateEvent({
        ...eventData,
        id: selectedEvent.id,
      });
      
      setSelectedEvent(null);
      console.log("Event updated successfully:", updatedEvent);
      
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

  const handleDeleteEvent = async (choice?: "this" | "series") => {
    try {
      if (!deleteEvent || !selectedEvent) throw new Error("Delete event function not provided or no event selected");
      
      const finalChoice = choice || deleteChoice;
      console.log("Deleting event with choice:", finalChoice);
      
      const result = await deleteEvent({ id: selectedEvent.id, deleteChoice: finalChoice });
      
      setSelectedEvent(null);
      console.log("Event deleted successfully:", selectedEvent.id);
      
      return result;
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

  // Helper function to check if event is part of a recurring series
  const isRecurringEvent = (event: CalendarEventType | null): boolean => {
    if (!event) return false;
    return event.is_recurring || !!event.parent_event_id;
  };

  return {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedDate,
    setSelectedDate,
    deleteChoice,
    setDeleteChoice,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    isRecurringEvent,
  };
};
