
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

  // Enhanced check for time slot availability that considers all event types
  const checkTimeSlotAvailability = async (
    startDate: Date,
    endDate: Date,
    businessId?: string | null, // Make businessId parameter nullable
    excludeEventId?: string
  ): Promise<{ available: boolean; conflictingEvent?: CalendarEventType }> => {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    console.log(`Checking availability for time slot: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`Business ID for availability check: ${businessId || 'none (personal calendar)'}`);
    
    try {
      // Set up the query conditions
      let query = supabase
        .from('events')
        .select('*')
        .gte('start_date', startDate.toISOString().split('T')[0])
        .lte('start_date', endDate.toISOString().split('T')[0] + 'T23:59:59');
      
      // Add user-specific or business-specific condition
      if (window && (window as any).__CURRENT_USER_ID__) {
        if (businessId) {
          // For business calendar, check events for this business
          query = query.eq('business_id', businessId);
        } else {
          // For personal calendar, check user's events
          query = query.eq('user_id', (window as any).__CURRENT_USER_ID__);
        }
      }
      
      const { data: directEvents, error: directError } = await query;
        
      if (directError) {
        console.error("Error fetching events for conflict check:", directError);
        throw directError;
      }
      
      // Also fetch approved event requests if we have a business ID
      let approvedRequests: any[] = [];
      if (businessId) {
        const { data: requests, error: requestsError } = await supabase
          .from('event_requests')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'approved')
          .gte('start_date', startDate.toISOString().split('T')[0])
          .lte('start_date', endDate.toISOString().split('T')[0] + 'T23:59:59');
          
        if (requestsError) {
          console.error("Error fetching approved requests for conflict check:", requestsError);
        } else {
          approvedRequests = requests || [];
        }
      }
      
      // Combine all events for checking
      const allEvents = [...(directEvents || []), ...approvedRequests];
      console.log(`Found ${allEvents.length} events/requests to check for conflicts`);
      
      // Check for conflicts
      const conflictingEvent = allEvents.find((event) => {
        if (excludeEventId && event.id === excludeEventId) return false;
        
        const eventStart = new Date(event.start_date).getTime();
        const eventEnd = new Date(event.end_date).getTime();
        
        // Exact same time slot
        if (startTime === eventStart && endTime === eventEnd) {
          console.log(`Conflict found: exact match with event ${event.id}`);
          return true;
        }
        
        // Start or end time falls within another event
        if ((startTime >= eventStart && startTime < eventEnd) || 
            (endTime > eventStart && endTime <= eventEnd)) {
          console.log(`Conflict found: overlap with event ${event.id}`);
          return true;
        }
        
        // Event completely contains the new time slot
        if (startTime <= eventStart && endTime >= eventEnd) {
          console.log(`Conflict found: new event contains existing event ${event.id}`);
          return true;
        }
        
        return false;
      });

      return {
        available: !conflictingEvent,
        conflictingEvent,
      };
    } catch (error) {
      console.error("Error in checkTimeSlotAvailability:", error);
      // If there's an error, we'll be cautious and say the slot is unavailable
      return { available: false };
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

      // Store current user ID in window for conflict checks
      if (typeof window !== 'undefined' && (window as any).__SUPABASE_AUTH_USER__?.id) {
        (window as any).__CURRENT_USER_ID__ = (window as any).__SUPABASE_AUTH_USER__.id;
      }

      // Check for business_id specifically and handle null/undefined case
      const businessId = data.business_id || null;
      console.log('handleCreateEvent - Using business ID:', businessId);

      const { available, conflictingEvent } = await checkTimeSlotAvailability(
        startDate,
        endDate,
        businessId
      );

      if (!available && conflictingEvent) {
        toast({
          title: "Time Slot Unavailable",
          description: `This time slot conflicts with an existing booking (${new Date(conflictingEvent.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent.end_date).toLocaleTimeString()})`,
          variant: "destructive",
        });
        throw new Error("Time slot conflict");
      }

      // Clean up the data object to ensure no null UUIDs are sent
      const cleanData = { ...data };
      if (cleanData.business_id === null || cleanData.business_id === undefined) {
        delete cleanData.business_id; // Remove businessId if it's null or undefined
      }

      console.log('handleCreateEvent - Cleaned data for submission:', cleanData);
      const result = await createEvent(cleanData);
      
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

      // Store current user ID in window for conflict checks
      if (typeof window !== 'undefined' && (window as any).__SUPABASE_AUTH_USER__?.id) {
        (window as any).__CURRENT_USER_ID__ = (window as any).__SUPABASE_AUTH_USER__.id;
      }

      // Handle null/undefined business_id
      const businessId = data.business_id || selectedEvent.business_id || null;

      const { available, conflictingEvent } = await checkTimeSlotAvailability(
        startDate,
        endDate,
        businessId,
        selectedEvent.id
      );

      if (!available && conflictingEvent) {
        toast({
          title: "Time Slot Unavailable",
          description: `This time slot conflicts with an existing booking (${new Date(conflictingEvent.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent.end_date).toLocaleTimeString()})`,
          variant: "destructive",
        });
        throw new Error("Time slot conflict");
      }

      // Clean up the data object
      const cleanData = { ...data };
      if (cleanData.business_id === null || cleanData.business_id === undefined) {
        delete cleanData.business_id;
      }

      const result = await updateEvent(cleanData);
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
