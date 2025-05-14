
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext"; // Import language context

interface UseEventDialogProps {
  createEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent?: (id: string) => Promise<void>;
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
  const { language } = useLanguage(); // Get current language

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      // Ensure type is set to 'event'
      const eventData = {
        ...data,
        type: 'event',
        // Make sure title and user_surname match for consistency
        title: data.user_surname || data.title,
        user_surname: data.user_surname || data.title,
        // Ensure payment_status is properly set and normalized
        payment_status: normalizePaymentStatus(data.payment_status) || 'not_paid',
        // Don't check availability by default for faster creation
        checkAvailability: false,
        // Add language to event data - use provided language or current app language
        language: data.language || language || 'en'
      };
      
      console.log("Creating event with language:", eventData.language);
      
      if (!createEvent) throw new Error("Create event function not provided");
      
      console.log("Creating event with data:", eventData);
      const createdEvent = await createEvent(eventData);
      
      setIsNewEventDialogOpen(false);
      console.log("Event created successfully:", createdEvent);
      
      return createdEvent;
    } catch (error: any) {
      console.error("Failed to create event:", error);
      toast.error({
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
      
      // Make sure to preserve the type field and ensure title and user_surname match
      const eventData = {
        ...data,
        type: selectedEvent.type || 'event',
        title: data.user_surname || data.title || selectedEvent.title,
        user_surname: data.user_surname || data.title || selectedEvent.user_surname,
        // Ensure payment_status is properly normalized and preserved
        payment_status: normalizePaymentStatus(data.payment_status) || normalizePaymentStatus(selectedEvent.payment_status) || 'not_paid',
        // Preserve language or set it if not already present
        language: data.language || selectedEvent.language || language || 'en'
      };
      
      console.log("Updating event with language:", eventData.language);
      
      // Set checkAvailability flag in memory, but remove it before sending to the database
      // to prevent the "column not found" error
      const shouldCheckAvailability = true;
      console.log("Updating event with data:", eventData);
      
      // Create a new object without the checkAvailability property to send to the database
      const { checkAvailability, ...dataToSend } = eventData as any;
      const updatedEvent = await updateEvent({
        ...dataToSend,
        // We'll handle the availability check in the useCalendarEvents hook
      });
      
      setSelectedEvent(null);
      console.log("Event updated successfully:", updatedEvent);
      
      return updatedEvent;
    } catch (error: any) {
      console.error("Failed to update event:", error);
      toast.error({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteEvent = async () => {
    try {
      if (!deleteEvent || !selectedEvent) throw new Error("Delete event function not provided or no event selected");
      
      await deleteEvent(selectedEvent.id);
      
      setSelectedEvent(null);
      console.log("Event deleted successfully:", selectedEvent.id);
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      toast.error({
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
    
    // Log the incoming status for debugging
    console.log("Normalizing payment status:", status);
    
    // Normalize partly paid variants
    if (status.includes('partly')) return 'partly_paid';
    
    // Normalize fully paid variants
    if (status.includes('fully')) return 'fully_paid';
    
    // Normalize not paid variants
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
