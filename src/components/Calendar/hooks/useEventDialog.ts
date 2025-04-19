import { useState, useEffect } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();

  useEffect(() => {
    if (selectedEvent) {
      setSelectedDate(new Date(selectedEvent.start_date));
    }
  }, [selectedEvent]);

  // Keep checkTimeSlotAvailability just for creating events
  const checkTimeSlotAvailability = async (
    startDate: Date,
    endDate: Date
  ): Promise<{ available: boolean; conflictingEvent?: CalendarEventType }> => {
    try {
      console.log("[useEventDialog][checkTimeSlotAvailability] Starting check with params:", {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        userId: user?.id || "no user"
      });
      
      if (!user) {
        console.log("[useEventDialog][checkTimeSlotAvailability] No user, returning available");
        return { available: true };
      }
      
      // First check regular events - make sure to filter by the current user's ID
      const { data: conflictingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id) 
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString())
        .is('deleted_at', null);
        
      if (eventsError) {
        console.error("[useEventDialog][checkTimeSlotAvailability] Error fetching events:", eventsError);
        throw eventsError;
      }
      
      console.log("[useEventDialog][checkTimeSlotAvailability] Found potential conflicting events:", 
        conflictingEvents?.length || 0);
      
      // For create operations we don't need to exclude any existing event ID
      const eventConflict = conflictingEvents?.find(event => {
        return !(startDate.getTime() >= new Date(event.end_date).getTime() || 
          endDate.getTime() <= new Date(event.start_date).getTime());
      });
      
      if (eventConflict) {
        console.log("[useEventDialog][checkTimeSlotAvailability] Found conflicting event:", eventConflict);
        return { available: false, conflictingEvent: eventConflict };
      }
      
      // Get the user's business profile if they have one
      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      // If user has a business profile, check approved booking requests for their business
      if (businessProfile?.id) {
        console.log("[useEventDialog][checkTimeSlotAvailability] Checking business bookings for business ID:", businessProfile.id);
        
        const { data: conflictingBookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('business_id', businessProfile.id)
          .eq('status', 'approved')
          .filter('start_date', 'lt', endDate.toISOString())
          .filter('end_date', 'gt', startDate.toISOString());
          
        if (bookingsError) {
          console.error("[useEventDialog][checkTimeSlotAvailability] Error fetching bookings:", bookingsError);
          throw bookingsError;
        }
        
        console.log("[useEventDialog][checkTimeSlotAvailability] Found potential conflicting bookings:", 
          conflictingBookings?.length || 0);
        
        // For create operations, no need to exclude booking IDs
        const bookingConflict = conflictingBookings?.find(booking => {
          return !(startDate.getTime() >= new Date(booking.end_date).getTime() || 
            endDate.getTime() <= new Date(booking.start_date).getTime());
        });
        
        if (bookingConflict) {
          console.log("[useEventDialog][checkTimeSlotAvailability] Found conflicting booking:", bookingConflict);
          // Convert booking to event format for the response
          const conflictEvent: CalendarEventType = {
            id: bookingConflict.id,
            title: bookingConflict.title,
            start_date: bookingConflict.start_date,
            end_date: bookingConflict.end_date,
            created_at: bookingConflict.created_at || new Date().toISOString(),
            user_id: bookingConflict.user_id || '',
            type: 'booking_request'
          };
          
          return { available: false, conflictingEvent: conflictEvent };
        }
      }

      console.log("[useEventDialog][checkTimeSlotAvailability] No conflicts found, slot is available");
      return { available: true };
    } catch (error) {
      console.error("[useEventDialog][checkTimeSlotAvailability] Error checking availability:", error);
      throw error;
    }
  };

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      console.log('[handleCreateEvent] Starting with data:', data);
      
      const startDate = new Date(data.start_date as string);
      const endDate = new Date(data.end_date as string);

      console.log('[handleCreateEvent] Parsed dates:', {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      });

      const { available, conflictingEvent } = await checkTimeSlotAvailability(
        startDate,
        endDate
      );

      if (!available && conflictingEvent) {
        console.log('[handleCreateEvent] Time slot unavailable:', conflictingEvent);
        toast({
          title: "Time Slot Unavailable",
          description: `This time slot conflicts with "${conflictingEvent.title}" (${new Date(conflictingEvent.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent.end_date).toLocaleTimeString()})`,
          variant: "destructive",
          duration: 5000, // Auto-dismiss after 5 seconds
        });
        throw new Error("Time slot conflict");
      }

      const result = await createEvent(data);
      setIsNewEventDialogOpen(false);
      toast({
        title: "Success",
        description: "Event created successfully",
        duration: 5000, // Auto-dismiss after 5 seconds
      });
      return result;
    } catch (error: any) {
      console.error('[handleCreateEvent] Error:', error);
      if (error.message !== "Time slot conflict") {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
          duration: 5000, // Auto-dismiss after 5 seconds
        });
      }
      throw error;
    }
  };

  const handleUpdateEvent = async (data: Partial<CalendarEventType>) => {
    if (!selectedEvent) {
      console.error('[handleUpdateEvent] No selected event');
      return;
    }
    
    try {
      console.log('[handleUpdateEvent] Updating event:', {
        id: selectedEvent.id,
        type: selectedEvent.type,
        data: data
      });
      
      // Ensure we always include the ID in the update
      const eventData: Partial<CalendarEventType> = {
        ...data,
        id: selectedEvent.id,
        // If the event has a type, preserve it
        type: selectedEvent.type
      };
      
      console.log('[handleUpdateEvent] Final event data being sent to updateEvent:', eventData);
      
      const result = await updateEvent(eventData);
      
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Event updated successfully",
        duration: 5000, // Auto-dismiss after 5 seconds
      });
      return result;
    } catch (error: any) {
      console.error('[handleUpdateEvent] Error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 5000, // Auto-dismiss after 5 seconds
      });
      throw error;
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    
    try {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('title', selectedEvent.title)
        .eq('start_date', selectedEvent.start_date)
        .eq('end_date', selectedEvent.end_date)
        .maybeSingle();

      if (customerError) {
        console.error('Error finding associated customer:', customerError);
        throw customerError;
      }

      if (customer) {
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            start_date: null,
            end_date: null
          })
          .eq('id', customer.id);

        if (updateError) {
          console.error('Error updating customer:', updateError);
          throw updateError;
        }
      }

      const { data: files } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', selectedEvent.id);

      if (files && files.length > 0) {
        for (const file of files) {
          const { error: storageError } = await supabase.storage
            .from('event_attachments')
            .remove([file.file_path]);

          if (storageError) {
            console.error('Error deleting file from storage:', storageError);
          }
        }

        const { error: filesDeleteError } = await supabase
          .from('event_files')
          .delete()
          .eq('event_id', selectedEvent.id);

        if (filesDeleteError) {
          console.error('Error deleting file records:', filesDeleteError);
          throw filesDeleteError;
        }
      }

      await deleteEvent(selectedEvent.id);
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Event deleted successfully",
        duration: 5000, // Auto-dismiss after 5 seconds
      });
    } catch (error: any) {
      console.error('handleDeleteEvent - Error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 5000, // Auto-dismiss after 5 seconds
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
