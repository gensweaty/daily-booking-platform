
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isVirtualInstance } from "@/lib/recurringEvents";

interface UseEventDialogProps {
  createEvent?: (data: Partial<CalendarEventType> & {
    email_reminder_enabled?: boolean;
    reminder_at?: string | null;
  }) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType> & {
    email_reminder_enabled?: boolean;
    reminder_at?: string | null;
  }) => Promise<CalendarEventType>;
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
  const { toast } = useToast();
  const { language } = useLanguage();

  const handleCreateEvent = async (data: Partial<CalendarEventType> & {
    email_reminder_enabled?: boolean;
    reminder_at?: string | null;
  }) => {
    try {
      const eventData = {
        ...data,
        type: 'event',
        title: data.user_surname || data.title,
        user_surname: data.user_surname || data.title,
        payment_status: normalizePaymentStatus(data.payment_status) || 'not_paid',
        checkAvailability: false,
        language: data.language || language || 'en',
        email_reminder_enabled: data.email_reminder_enabled || false,
        reminder_at: data.reminder_at || null
      };
      
      console.log("Creating event with language and reminder data:", {
        language: eventData.language,
        email_reminder_enabled: eventData.email_reminder_enabled,
        reminder_at: eventData.reminder_at
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

  const handleUpdateEvent = async (data: Partial<CalendarEventType> & {
    email_reminder_enabled?: boolean;
    reminder_at?: string | null;
  }) => {
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
        language: data.language || selectedEvent.language || language || 'en',
        email_reminder_enabled: data.email_reminder_enabled !== undefined ? data.email_reminder_enabled : selectedEvent.email_reminder_enabled || false,
        reminder_at: data.reminder_at !== undefined ? data.reminder_at : selectedEvent.reminder_at || null
      };
      
      console.log("Updating event with language and reminder data:", {
        language: eventData.language,
        email_reminder_enabled: eventData.email_reminder_enabled,
        reminder_at: eventData.reminder_at
      });
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

  const handleDeleteEvent = async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
    try {
      if (!deleteEvent) throw new Error("Delete event function not provided");
      
      const result = await deleteEvent({ id, deleteChoice });
      
      setSelectedEvent(null);
      console.log("Event deleted successfully:", id);
      
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
