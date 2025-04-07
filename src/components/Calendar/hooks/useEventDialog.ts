
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
      console.log("Checking availability with existingEventId:", existingEventId);
      
      // First check regular events
      const { data: conflictingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString());
        
      if (eventsError) throw eventsError;
      
      const eventConflict = conflictingEvents?.find(event => {
        // Skip the current event being updated
        if (existingEventId && event.id === existingEventId) {
          console.log("Excluding event from conflict check:", event.id);
          return false;
        }
        
        // Check for actual conflicts (not just edge touching)
        const eventStart = new Date(event.start_date);
        const eventEnd = new Date(event.end_date);
        
        return !(startDate.getTime() >= eventEnd.getTime() || 
                 endDate.getTime() <= eventStart.getTime());
      });
      
      if (eventConflict) {
        console.log("Found conflicting event:", eventConflict);
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
      
      const bookingConflict = conflictingBookings?.find(booking => {
        // Skip the current booking being updated
        if (existingEventId && booking.id === existingEventId) {
          console.log("Excluding booking from conflict check:", booking.id);
          return false;
        }
        
        // Check for actual conflicts (not just edge touching)
        const bookingStart = new Date(booking.start_date);
        const bookingEnd = new Date(booking.end_date);
        
        return !(startDate.getTime() >= bookingEnd.getTime() || 
                 endDate.getTime() <= bookingStart.getTime());
      });
      
      if (bookingConflict) {
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

      // Pass the current event ID to exclude it from conflict checking
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
      // Check if this is a booking request
      const { data: bookingRequest, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', selectedEvent.id)
        .maybeSingle();

      if (bookingError && bookingError.code !== 'PGRST116') {
        console.error('Error checking for booking request:', bookingError);
      }

      // Find associated customer record
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

      // Update customer if found
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

      // Delete associated files - first get list of files
      const { data: files, error: fileQueryError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', selectedEvent.id);
      
      if (fileQueryError) {
        console.error('Error querying event files:', fileQueryError);
      }

      if (files && files.length > 0) {
        console.log(`Found ${files.length} files to delete for event ${selectedEvent.id}`);
        
        // Delete files from storage
        for (const file of files) {
          const { error: storageError } = await supabase.storage
            .from('event_attachments')
            .remove([file.file_path]);

          if (storageError) {
            console.error('Error deleting file from storage:', storageError);
          } else {
            console.log(`Deleted file ${file.filename} from storage`);
          }
        }

        // Delete file records from database
        const { error: filesDeleteError } = await supabase
          .from('event_files')
          .delete()
          .eq('event_id', selectedEvent.id);

        if (filesDeleteError) {
          console.error('Error deleting file records:', filesDeleteError);
          throw filesDeleteError;
        } else {
          console.log(`Deleted ${files.length} file records from database`);
        }
      }

      // Handle deletion of booking request or regular event
      if (bookingRequest) {
        const { error: deleteError } = await supabase
          .from('booking_requests')
          .delete()
          .eq('id', selectedEvent.id);
          
        if (deleteError) {
          console.error('Error deleting booking request:', deleteError);
          throw deleteError;
        }
        console.log(`Deleted booking request with ID ${selectedEvent.id}`);
      } else {
        await deleteEvent(selectedEvent.id);
        console.log(`Deleted regular event with ID ${selectedEvent.id}`);
      }
      
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
