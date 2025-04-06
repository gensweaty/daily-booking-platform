
import { useState, useEffect } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";

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
      // Skip conflict check for approved events - Fix for issue #1
      if (existingEventId && selectedEvent?.type === 'booking_request' && selectedEvent.status === 'approved') {
        console.log("Skipping conflict check for approved booking event:", existingEventId);
        return { available: true };
      }

      // First check regular events
      const { data: conflictingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString());
        
      if (eventsError) throw eventsError;
      
      const eventConflict = conflictingEvents?.find(event => 
        (!existingEventId || event.id !== existingEventId) &&
        !(startDate.getTime() === new Date(event.end_date).getTime() || 
          endDate.getTime() === new Date(event.start_date).getTime())
      );
      
      if (eventConflict) {
        return { available: false, conflictingEvent: eventConflict };
      }
      
      // Then check approved booking requests
      const { data: conflictingBookings, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('status', 'approved')
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString());
        
      if (bookingsError) throw bookingsError;
      
      const bookingConflict = conflictingBookings?.find(booking => 
        !(startDate.getTime() === new Date(booking.end_date).getTime() || 
          endDate.getTime() === new Date(booking.start_date).getTime())
      );
      
      if (bookingConflict) {
        // Convert booking to event format for the response
        const conflictEvent: CalendarEventType = {
          id: bookingConflict.id,
          title: bookingConflict.title,
          start_date: bookingConflict.start_date,
          end_date: bookingConflict.end_date,
          created_at: bookingConflict.created_at || new Date().toISOString(),
          user_id: bookingConflict.user_id || '',
          type: 'booking_request',
          status: bookingConflict.status // Make sure to pass the status
        };
        
        return { available: false, conflictingEvent: conflictEvent };
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
      const startDate = new Date(data.start_date as string);
      const endDate = new Date(data.end_date as string);

      // Fix for issue #1: Skip conflict check for certain event types
      let skipConflictCheck = false;
      
      // Skip conflict check for approved booking requests
      if (selectedEvent.type === 'booking_request' && selectedEvent.status === 'approved') {
        console.log("Skipping conflict check for approved booking:", selectedEvent.id);
        skipConflictCheck = true;
      }

      if (!skipConflictCheck) {
        const { available, conflictingEvent } = await checkTimeSlotAvailability(
          startDate,
          endDate,
          selectedEvent.id
        );

        if (!available && conflictingEvent) {
          toast({
            title: "Time Slot Unavailable",
            description: `This time slot conflicts with "${conflictingEvent.title}" (${new Date(conflictingEvent.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent.end_date).toLocaleTimeString()})`,
            variant: "destructive",
          });
          throw new Error("Time slot conflict");
        }
      }

      const result = await updateEvent(data);
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
