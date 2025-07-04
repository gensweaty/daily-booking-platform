
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface UseEventDialogProps {
  createEvent?: (data: Partial<CalendarEventType> & { additionalPersons?: PersonData[] }) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType> & { additionalPersons?: PersonData[] }) => Promise<CalendarEventType>;
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

  // CRUCIAL FIX: Validate event data before calling database functions
  const validateEventData = (data: Partial<CalendarEventType>) => {
    console.log("🔍 Validating event data in dialog:", data);
    
    // Ensure we have required dates
    if (!data.start_date || !data.end_date) {
      throw new Error("Start date and end date are required");
    }

    // Ensure dates are valid
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid date format");
    }

    // Ensure we have a title
    const title = data.user_surname || data.title;
    if (!title || title.trim() === '') {
      throw new Error("Event title is required");
    }

    return {
      ...data,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      title: title.trim(),
      user_surname: title.trim(),
      payment_status: normalizePaymentStatus(data.payment_status) || 'not_paid',
      language: data.language || language || 'en'
    };
  };

  const handleCreateEvent = async (data: Partial<CalendarEventType>, additionalPersons: PersonData[] = []) => {
    try {
      console.log("🔄 Creating event with raw data:", data);
      console.log("👥 Creating event with additional persons:", additionalPersons);
      
      // CRUCIAL FIX: Validate data before processing
      const validatedData = validateEventData(data);
      
      const eventData = {
        ...validatedData,
        type: 'event',
        checkAvailability: false,
        additionalPersons, // CRUCIAL FIX: Pass the actual persons array
      };
      
      console.log("🔄 Creating event with validated data:", eventData);
      
      if (!createEvent) throw new Error("Create event function not provided");
      
      const createdEvent = await createEvent(eventData);
      
      setIsNewEventDialogOpen(false);
      console.log("✅ Event created successfully:", createdEvent);
      
      return createdEvent;
    } catch (error: any) {
      console.error("❌ Failed to create event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateEvent = async (data: Partial<CalendarEventType>, additionalPersons: PersonData[] = []) => {
    try {
      if (!updateEvent || !selectedEvent) {
        throw new Error("Update event function not provided or no event selected");
      }
      
      console.log("🔄 Updating event with raw data:", data);
      console.log("👥 Updating event with additional persons:", additionalPersons);
      
      // CRUCIAL FIX: Validate data before processing
      const validatedData = validateEventData({
        ...data,
        start_date: data.start_date || selectedEvent.start_date,
        end_date: data.end_date || selectedEvent.end_date,
        title: data.user_surname || data.title || selectedEvent.title,
      });
      
      const eventData = {
        ...validatedData,
        type: selectedEvent.type || 'event',
        language: validatedData.language || selectedEvent.language || language || 'en',
        additionalPersons, // CRUCIAL FIX: Pass the actual persons array
      };
      
      console.log("🔄 Updating event with validated data:", eventData);
      
      const updatedEvent = await updateEvent({
        ...eventData,
        id: selectedEvent.id,
      });
      
      setSelectedEvent(null);
      console.log("✅ Event updated successfully:", updatedEvent);
      
      return updatedEvent;
    } catch (error: any) {
      console.error("❌ Failed to update event:", error);
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
      console.log("✅ Event deleted successfully:", selectedEvent.id);
      
      return result;
    } catch (error: any) {
      console.error("❌ Failed to delete event:", error);
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
    
    console.log("🔄 Normalizing payment status:", status);
    
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
