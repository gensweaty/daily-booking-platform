
import { useState, useEffect } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
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

  useEffect(() => {
    console.log('useEventDialog - selectedDate changed:', selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    console.log('useEventDialog - dialog open state changed:', isNewEventDialogOpen);
    console.log('useEventDialog - current selectedDate:', selectedDate);
  }, [isNewEventDialogOpen]);

  const checkTimeSlotAvailability = async (
    startDate: Date,
    endDate: Date,
    existingEventId?: string
  ): Promise<{ available: boolean; conflictingEvent?: CalendarEventType }> => {
    try {
      console.log("Checking time slot availability:", {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        excludeId: existingEventId,
        userId: user?.id,
        selectedEventId: selectedEvent?.id,
        selectedEventType: selectedEvent?.type
      });
      
      if (!user) {
        return { available: true };
      }
      
      // Always skip conflict checking if we're not changing the event times
      if (existingEventId && selectedEvent) {
        const originalStart = new Date(selectedEvent.start_date).getTime();
        const originalEnd = new Date(selectedEvent.end_date).getTime();
        const newStart = startDate.getTime();
        const newEnd = endDate.getTime();
        
        if (originalStart === newStart && originalEnd === newEnd) {
          console.log("Skipping time slot check for unchanged event times");
          return { available: true };
        }
      }
      
      // Get all events for this user
      const { data: conflictingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString())
        .is('deleted_at', null);
        
      if (eventsError) throw eventsError;
      
      // Check for conflicts, strictly excluding the current event
      const eventConflict = conflictingEvents?.find(event => 
        event.id !== existingEventId &&
        !(startDate.getTime() >= new Date(event.end_date).getTime() || 
          endDate.getTime() <= new Date(event.start_date).getTime())
      );
      
      console.log("Conflicting events (excluding current):", 
        conflictingEvents?.filter(e => e.id !== existingEventId && !e.deleted_at));
      
      if (eventConflict) {
        return { available: false, conflictingEvent: eventConflict };
      }
      
      // Check for conflicts with bookings if user has a business profile
      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (businessProfile?.id) {
        console.log("Checking booking conflicts for business profile:", businessProfile.id);
        
        const { data: conflictingBookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('business_id', businessProfile.id)
          .eq('status', 'approved')
          .filter('start_date', 'lt', endDate.toISOString())
          .filter('end_date', 'gt', startDate.toISOString());
          
        if (bookingsError) throw bookingsError;
        
        // Log all booking IDs for debugging
        console.log("existingEventId:", existingEventId);
        console.log("selectedEvent ID:", selectedEvent?.id);
        console.log("selectedEvent type:", selectedEvent?.type);
        console.log("Conflicting booking IDs:", conflictingBookings?.map(b => b.id));
        
        // Enhanced booking conflict logic - check if the booking is the one being edited
        const isSameBooking = (booking: any) => {
          return (
            booking.id === existingEventId || // direct ID match
            selectedEvent?.id === booking.id || // selected event ID matches booking ID
            (selectedEvent?.type === 'booking_request' && selectedEvent?.id === booking.id) // booking-originated event
          );
        };
        
        const bookingConflict = conflictingBookings?.find(booking => 
          !isSameBooking(booking) &&
          !(startDate.getTime() >= new Date(booking.end_date).getTime() || 
            endDate.getTime() <= new Date(booking.start_date).getTime())
        );
        
        console.log("Conflicting bookings (excluding current):", 
          conflictingBookings?.filter(b => !isSameBooking(b)));
        
        if (bookingConflict) {
          const conflictEvent: CalendarEventType = {
            id: bookingConflict.id,
            title: bookingConflict.title,
            start_date: bookingConflict.start_date,
            end_date: bookingConflict.end_date,
            created_at: bookingConflict.created_at || new Date().toISOString(),
            user_id: bookingConflict.user_id || '',
            type: 'booking_request'
          };
          
          console.warn("Detected conflict with booking:", bookingConflict);
          return { available: false, conflictingEvent: conflictEvent };
        }
      }

      return { available: true };
    } catch (error) {
      console.error("Error checking time slot availability:", error);
      throw error;
    }
  };

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      console.log('handleCreateEvent - Received data:', data);
      
      const startDate = new Date(data.start_date as string);
      const endDate = new Date(data.end_date as string);

      console.log('handleCreateEvent - Parsed dates:', {
        start: startDate,
        end: endDate
      });

      // For new events, do check for conflicts
      const { available, conflictingEvent } = await checkTimeSlotAvailability(
        startDate,
        endDate
      );

      if (!available && conflictingEvent) {
        toast({
          title: "Time Slot Unavailable",
          description: `This time slot conflicts with "${conflictingEvent.title}" (${new Date(conflictingEvent.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent.end_date).toLocaleTimeString()})`,
          variant: "destructive",
        });
        throw new Error("Time slot conflict");
      }

      const result = await createEvent(data);
      setIsNewEventDialogOpen(false);
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      return result;
    } catch (error: any) {
      console.error('handleCreateEvent - Error:', error);
      if (error.message !== "Time slot conflict") {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const handleUpdateEvent = async (data: Partial<CalendarEventType>) => {
    if (!selectedEvent) return;
    
    try {
      console.log('handleUpdateEvent - Updating event:', selectedEvent.id);
      console.log('handleUpdateEvent - With data:', data);
      console.log('handleUpdateEvent - Event type:', selectedEvent.type);
      
      const startDate = new Date(data.start_date as string);
      const endDate = new Date(data.end_date as string);
      
      const originalStart = new Date(selectedEvent.start_date).getTime();
      const originalEnd = new Date(selectedEvent.end_date).getTime();
      const newStart = startDate.getTime();
      const newEnd = endDate.getTime();
      const timesChanged = originalStart !== newStart || originalEnd !== newEnd;
      
      console.log('Times changed?', timesChanged, {
        originalStart,
        originalEnd,
        newStart,
        newEnd
      });

      // Only check for conflicts if the times have changed
      if (timesChanged) {
        console.log('Dates changed, checking for conflicts');
        
        const { available, conflictingEvent } = await checkTimeSlotAvailability(
          startDate,
          endDate,
          selectedEvent.id
        );

        if (!available && conflictingEvent) {
          if (conflictingEvent.id !== selectedEvent.id) {
            toast({
              title: "Time Slot Unavailable",
              description: `This time slot conflicts with "${conflictingEvent.title}" (${new Date(conflictingEvent.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent.end_date).toLocaleTimeString()})`,
              variant: "destructive",
            });
            throw new Error("Time slot conflict");
          }
        }
      } else {
        console.log('Dates unchanged, skipping conflict check');
      }

      // Preserve event type and ID for updates
      const updateData: Partial<CalendarEventType> = {
        ...data,
        id: selectedEvent.id,
        type: data.type || selectedEvent.type
      };
      
      console.log('Sending update with complete data:', updateData);
      
      const result = await updateEvent(updateData);
      
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      return result;
    } catch (error: any) {
      console.error('handleUpdateEvent - Error:', error);
      if (error.message !== "Time slot conflict") {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
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
      });
    } catch (error: any) {
      console.error('handleDeleteEvent - Error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
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
