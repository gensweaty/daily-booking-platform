
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isVirtualInstance } from "@/lib/recurringEvents";

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
  const [showDeleteChoiceDialog, setShowDeleteChoiceDialog] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();

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

  const handleDeleteEvent = async (deleteChoice?: "this" | "series") => {
    try {
      if (!deleteEvent || !selectedEvent) throw new Error("Delete event function not provided or no event selected");
      
      // If it's a virtual instance and no choice provided, show choice dialog
      if (isVirtualInstance(selectedEvent.id) && !deleteChoice) {
        setShowDeleteChoiceDialog(true);
        return { success: false }; // Don't close dialog yet
      }
      
      const result = await deleteEvent({ id: selectedEvent.id, deleteChoice });
      
      setSelectedEvent(null);
      setShowDeleteChoiceDialog(false);
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
    showDeleteChoiceDialog,
    setShowDeleteChoiceDialog,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  };
};
