
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimeConflictValidation } from "@/hooks/useTimeConflictValidation";

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
  const [pendingEventData, setPendingEventData] = useState<Partial<CalendarEventType> | null>(null);
  const [showConflictCheck, setShowConflictCheck] = useState(false);
  
  const { toast } = useToast();
  const { language } = useLanguage();

  // Time conflict validation hook
  const conflictValidation = useTimeConflictValidation({
    startDate: pendingEventData?.start_date || '',
    endDate: pendingEventData?.end_date || '',
    excludeEventId: selectedEvent?.id,
    enabled: showConflictCheck && !!pendingEventData?.start_date && !!pendingEventData?.end_date
  });

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
      
      // Set up conflict checking
      setPendingEventData(eventData);
      setShowConflictCheck(true);
      
      // Wait a moment for the query to execute
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if we have conflict data
      if (conflictValidation.data?.hasConflict) {
        console.log("Time conflicts detected:", conflictValidation.data.conflicts);
        // The UI will show the warning, but we still proceed with creation
        // This is just informational
      }
      
      console.log("Creating event with data:", eventData);
      const createdEvent = await createEvent(eventData);
      
      setIsNewEventDialogOpen(false);
      setPendingEventData(null);
      setShowConflictCheck(false);
      console.log("Event created successfully:", createdEvent);
      
      return createdEvent;
    } catch (error: any) {
      console.error("Failed to create event:", error);
      setPendingEventData(null);
      setShowConflictCheck(false);
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
      
      // Set up conflict checking for updates
      setPendingEventData(eventData);
      setShowConflictCheck(true);
      
      // Wait a moment for the query to execute
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if we have conflict data
      if (conflictValidation.data?.hasConflict) {
        console.log("Time conflicts detected for update:", conflictValidation.data.conflicts);
        // The UI will show the warning, but we still proceed with update
      }
      
      console.log("Updating event with data:", eventData);
      
      const updatedEvent = await updateEvent({
        ...eventData,
        id: selectedEvent.id,
      });
      
      setSelectedEvent(null);
      setPendingEventData(null);
      setShowConflictCheck(false);
      console.log("Event updated successfully:", updatedEvent);
      
      return updatedEvent;
    } catch (error: any) {
      console.error("Failed to update event:", error);
      setPendingEventData(null);
      setShowConflictCheck(false);
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
      
      const result = await deleteEvent({ id: selectedEvent.id, deleteChoice });
      
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
    // Expose conflict validation data and state
    conflictValidation,
    showConflictCheck,
    pendingEventData,
  };
};
