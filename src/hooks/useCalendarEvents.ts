
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchEvents = async (): Promise<CalendarEventType[]> => {
    try {
      // Determine which user's events to fetch
      const targetUserId = businessUserId || user?.id;
      
      if (!targetUserId) {
        console.log("No user ID available for fetching events");
        return [];
      }

      console.log("🔄 Fetching events for user:", targetUserId, "business:", businessId);

      // Fetch ALL events from the events table (including recurring child events)
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (eventsError) {
        console.error("❌ Error fetching events:", eventsError);
        throw eventsError;
      }

      // Fetch booking requests if we have a business ID
      let bookingRequests: any[] = [];
      if (businessId) {
        const { data: bookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('business_id', businessId)
          .is('deleted_at', null)
          .order('start_date', { ascending: true });

        if (bookingsError) {
          console.error("❌ Error fetching booking requests:", bookingsError);
        } else {
          bookingRequests = bookings || [];
        }
      }

      // Separate regular events from deletion exceptions
      const regularEvents = events?.filter(event => 
        event.type !== 'deletion_exception' && 
        !event.title?.startsWith('__DELETED_') && 
        event.user_surname !== '__SYSTEM_DELETION_EXCEPTION__'
      ) || [];
      
      const deletionExceptions = events?.filter(event => 
        event.type === 'deletion_exception' || 
        event.title?.startsWith('__DELETED_') || 
        event.user_surname === '__SYSTEM_DELETION_EXCEPTION__'
      ) || [];

      console.log("📊 Event breakdown:", {
        totalEvents: events?.length || 0,
        regularEvents: regularEvents.length,
        deletionExceptions: deletionExceptions.length,
        bookingRequests: bookingRequests.length
      });

      // Convert all data to CalendarEventType format
      const allEvents: CalendarEventType[] = [];

      // Add ALL regular events (both parent and child recurring events)
      for (const event of regularEvents) {
        // Check if this is a deleted instance
        const eventDate = event.start_date.split('T')[0];
        const isDeleted = deletionExceptions.some(exception => {
          const exceptionDate = exception.start_date.split('T')[0];
          return exceptionDate === eventDate && (
            // Check if it's for the same parent event
            exception.parent_event_id === event.parent_event_id ||
            exception.parent_event_id === event.id ||
            (event.parent_event_id && exception.parent_event_id === event.parent_event_id)
          );
        });

        if (!isDeleted) {
          allEvents.push({
            id: event.id,
            title: event.title,
            start_date: event.start_date,
            end_date: event.end_date,
            user_id: event.user_id,
            user_surname: event.user_surname,
            user_number: event.user_number,
            social_network_link: event.social_network_link,
            event_notes: event.event_notes,
            event_name: event.event_name,
            payment_status: event.payment_status,
            payment_amount: event.payment_amount,
            type: event.type || 'event',
            is_recurring: event.is_recurring || false,
            repeat_pattern: event.repeat_pattern,
            repeat_until: event.repeat_until,
            parent_event_id: event.parent_event_id,
            language: event.language,
            created_at: event.created_at || new Date().toISOString(),
          });
        }
      }

      // Add booking requests
      for (const booking of bookingRequests) {
        allEvents.push({
          id: booking.id,
          title: booking.title,
          start_date: booking.start_date,
          end_date: booking.end_date,
          user_id: booking.user_id,
          user_surname: booking.requester_name,
          user_number: booking.requester_phone,
          social_network_link: booking.requester_email,
          event_notes: booking.description,
          payment_status: booking.payment_status,
          payment_amount: booking.payment_amount,
          type: 'booking_request',
          language: booking.language,
          created_at: booking.created_at || new Date().toISOString(),
        });
      }

      // Log recurring events info
      const parentEvents = allEvents.filter(e => e.is_recurring && !e.parent_event_id);
      const childEvents = allEvents.filter(e => e.parent_event_id);
      
      console.log("🔁 Recurring events summary:", {
        parentRecurringEvents: parentEvents.length,
        childRecurringEvents: childEvents.length,
        totalEvents: allEvents.length
      });

      if (parentEvents.length > 0) {
        console.log("👨‍👩‍👧‍👦 Parent recurring events:", parentEvents.map(e => ({
          id: e.id,
          title: e.title,
          pattern: e.repeat_pattern,
          start: e.start_date
        })));
      }

      if (childEvents.length > 0) {
        console.log("👶 Child recurring events:", childEvents.map(e => ({
          id: e.id,
          title: e.title,
          parent_id: e.parent_event_id,
          start: e.start_date
        })));
      }

      console.log(`✅ Loaded ${allEvents.length} total events (${regularEvents.length} regular + ${bookingRequests.length} bookings, filtered ${deletionExceptions.length} exceptions)`);
      return allEvents;

    } catch (error) {
      console.error("❌ Error in fetchEvents:", error);
      throw error;
    }
  };

  const {
    data: events = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: businessId ? ['business-events', businessId] : ['events', user?.id],
    queryFn: fetchEvents,
    enabled: !!(businessUserId || user?.id),
    staleTime: 30 * 1000, // 30 seconds
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("🔄 Creating event with data:", eventData);

      // Use the new database function for atomic operations
      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: {
          title: eventData.user_surname || eventData.title,
          user_surname: eventData.user_surname,
          user_number: eventData.user_number,
          social_network_link: eventData.social_network_link,
          event_notes: eventData.event_notes,
          event_name: eventData.event_name,
          start_date: eventData.start_date,
          end_date: eventData.end_date,
          payment_status: eventData.payment_status || 'not_paid',
          payment_amount: eventData.payment_amount?.toString() || '',
          type: eventData.type || 'event',
          is_recurring: eventData.is_recurring || false,
          repeat_pattern: eventData.repeat_pattern,
          repeat_until: eventData.repeat_until
        },
        p_additional_persons: [], // No additional persons for direct creation
        p_user_id: user.id,
        p_event_id: null
      });

      if (error) throw error;

      // Return a complete CalendarEventType object
      return {
        id: savedEventId,
        title: eventData.user_surname || eventData.title || 'Untitled Event',
        start_date: eventData.start_date || new Date().toISOString(),
        end_date: eventData.end_date || new Date().toISOString(),
        user_id: user.id,
        type: eventData.type || 'event',
        created_at: new Date().toISOString(),
        ...eventData
      } as CalendarEventType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error: any) => {
      console.error("❌ Error creating event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType> & { id: string }) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("🔄 Updating event with data:", eventData);

      // Use the new database function for atomic operations
      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: {
          title: eventData.user_surname || eventData.title,
          user_surname: eventData.user_surname,
          user_number: eventData.user_number,
          social_network_link: eventData.social_network_link,
          event_notes: eventData.event_notes,
          event_name: eventData.event_name,
          start_date: eventData.start_date,
          end_date: eventData.end_date,
          payment_status: eventData.payment_status || 'not_paid',
          payment_amount: eventData.payment_amount?.toString() || '',
          type: eventData.type || 'event',
          is_recurring: eventData.is_recurring || false,
          repeat_pattern: eventData.repeat_pattern,
          repeat_until: eventData.repeat_until
        },
        p_additional_persons: [], // Additional persons handled in EventDialog
        p_user_id: user.id,
        p_event_id: eventData.id
      });

      if (error) throw error;

      // Return a complete CalendarEventType object
      return {
        id: savedEventId,
        title: eventData.user_surname || eventData.title || 'Untitled Event',
        start_date: eventData.start_date || new Date().toISOString(),
        end_date: eventData.end_date || new Date().toISOString(),
        user_id: user.id,
        type: eventData.type || 'event',
        created_at: eventData.created_at || new Date().toISOString(),
        ...eventData
      } as CalendarEventType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("❌ Error updating event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("🗑️ Deleting event:", id, deleteChoice);

      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error("❌ Error deleting event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  return {
    events,
    isLoading,
    error,
    refetch,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};
