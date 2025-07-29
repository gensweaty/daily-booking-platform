
import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isVirtualInstance } from "@/lib/recurringEvents";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();
  const { language } = useLanguage();

  // Helper function to check for time conflicts using simple queries
  const checkTimeConflicts = async (
    startDate: string,
    endDate: string,
    userId: string,
    excludeEventId?: string
  ) => {
    try {
      const conflicts: Array<{
        event_title: string;
        event_start: string;
        event_end: string;
        event_type: string;
      }> = [];

      // Check regular events for conflicts
      const { data: eventConflicts, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, type')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .lt('start_date', endDate)
        .gt('end_date', startDate);

      if (eventsError) {
        console.error('Error checking event conflicts:', eventsError);
        return [];
      }

      if (eventConflicts && eventConflicts.length > 0) {
        eventConflicts.forEach(event => {
          if (!excludeEventId || event.id !== excludeEventId) {
            conflicts.push({
              event_title: event.title,
              event_start: event.start_date,
              event_end: event.end_date,
              event_type: event.type || 'event'
            });
          }
        });
      }

      // Check approved booking requests for conflicts
      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (businessProfile) {
        const { data: bookingConflicts, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('id, title, start_date, end_date')
          .eq('business_id', businessProfile.id)
          .eq('status', 'approved')
          .is('deleted_at', null)
          .lt('start_date', endDate)
          .gt('end_date', startDate);

        if (!bookingsError && bookingConflicts && bookingConflicts.length > 0) {
          bookingConflicts.forEach(booking => {
            if (!excludeEventId || booking.id !== excludeEventId) {
              conflicts.push({
                event_title: booking.title,
                event_start: booking.start_date,
                event_end: booking.end_date,
                event_type: 'booking_request'
              });
            }
          });
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error in checkTimeConflicts:', error);
      return [];
    }
  };

  // Helper function to format error messages for better user experience
  const formatErrorMessage = (error: any): string => {
    if (!error?.message) return "An unexpected error occurred";
    
    const message = error.message;
    
    // Check if it's a time conflict error from the database
    if (message.includes('Time conflict detected')) {
      return message;
    }
    
    return message;
  };

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
      
      // Check for time conflicts before creating
      if (eventData.start_date && eventData.end_date) {
        const conflicts = await checkTimeConflicts(
          eventData.start_date,
          eventData.end_date,
          eventData.user_id || ''
        );
        
        if (conflicts.length > 0) {
          const conflictMessage = `Time conflict detected with existing events: ${conflicts.map(c => 
            `"${c.event_title}" (${new Date(c.event_start).toLocaleString()} - ${new Date(c.event_end).toLocaleString()})`
          ).join(', ')}`;
          
          toast({
            title: "Time Conflict",
            description: conflictMessage,
            variant: "destructive",
          });
          throw new Error(conflictMessage);
        }
      }
      
      console.log("Creating event with data:", eventData);
      const createdEvent = await createEvent(eventData);
      
      setIsNewEventDialogOpen(false);
      console.log("Event created successfully:", createdEvent);
      
      return createdEvent;
    } catch (error: any) {
      console.error("Failed to create event:", error);
      toast({
        title: "Error",
        description: formatErrorMessage(error),
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
      
      // Check for time conflicts before updating (exclude current event)
      if (eventData.start_date && eventData.end_date) {
        const conflicts = await checkTimeConflicts(
          eventData.start_date,
          eventData.end_date,
          selectedEvent.user_id,
          selectedEvent.id
        );
        
        if (conflicts.length > 0) {
          const conflictMessage = `Time conflict detected with existing events: ${conflicts.map(c => 
            `"${c.event_title}" (${new Date(c.event_start).toLocaleString()} - ${new Date(c.event_end).toLocaleString()})`
          ).join(', ')}`;
          
          toast({
            title: "Time Conflict",
            description: conflictMessage,
            variant: "destructive",
          });
          throw new Error(conflictMessage);
        }
      }
      
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
        description: formatErrorMessage(error),
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
        description: formatErrorMessage(error),
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
