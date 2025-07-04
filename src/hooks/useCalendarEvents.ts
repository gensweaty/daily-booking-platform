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

      console.log("🔍 Fetching events for user:", targetUserId, "business:", businessId);

      // Fetch ALL events from the events table (both parent and child events)
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

      // DEBUG: Comprehensive logging for recurring events
      console.log("📊 RAW fetched events:", events);
      console.log(
        "📈 Fetched events count:", events?.length,
        "\n📝 Sample (first 5):",
        (events || []).slice(0, 5)
      );
      
      const parentEvents = (events || []).filter(ev => !ev.parent_event_id);
      const childEvents = (events || []).filter(ev => !!ev.parent_event_id);
      const recurringParents = parentEvents.filter(ev => ev.is_recurring);
      
      console.log("👨‍👩‍👧‍👦 Parent events:", parentEvents.length);
      console.log("👶 Child events (recurring instances):", childEvents.length);
      console.log("🔄 Recurring parent events:", recurringParents.length);
      
      // Log detailed info about recurring events
      if (recurringParents.length > 0) {
        console.log("🔍 Recurring parents details:", recurringParents.map(ev => ({
          id: ev.id,
          title: ev.title,
          start_date: ev.start_date,
          is_recurring: ev.is_recurring,
          repeat_pattern: ev.repeat_pattern,
          repeat_until: ev.repeat_until,
          childCount: childEvents.filter(child => child.parent_event_id === ev.id).length
        })));
      }
      
      // Check for any events on July 4th, 2025 specifically
      const july4Events = (events || []).filter(ev => {
        const eventDate = new Date(ev.start_date);
        return eventDate.getMonth() === 6 && eventDate.getDate() === 4 && eventDate.getFullYear() === 2025;
      });
      
      if (july4Events.length > 0) {
        console.log("🎆 July 4th events found:", july4Events.map(ev => ({
          id: ev.id,
          title: ev.title,
          parent_event_id: ev.parent_event_id,
          is_recurring: ev.is_recurring,
          repeat_pattern: ev.repeat_pattern,
          repeat_until: ev.repeat_until
        })));
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

      // Convert all data to CalendarEventType format
      const allEvents: CalendarEventType[] = [];

      // Add ALL events (both parent and child recurring events) - DO NOT filter by parent_event_id
      for (const event of events || []) {
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
          parent_event_id: event.parent_event_id, // Include parent_event_id for child events
          language: event.language,
          created_at: event.created_at || new Date().toISOString(),
        });
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

      console.log(`✅ Final events count: ${allEvents.length} (${events?.length || 0} events + ${bookingRequests.length} bookings)`);
      console.log("🔍 Final allEvents sample:", allEvents.slice(0, 3));
      
      // Return ALL events - no filtering by parent_event_id
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

      // CRITICAL: Ensure proper date formatting and repeat_until in YYYY-MM-DD format
      const formatDateForSQL = (dateStr: string) => {
        if (!dateStr) return null;
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            console.error("❌ Invalid date:", dateStr);
            return null;
          }
          return date.toISOString();
        } catch (error) {
          console.error("❌ Error formatting date for SQL:", error);
          return dateStr;
        }
      };

      // CRITICAL: Ensure repeat_until is YYYY-MM-DD format
      const formatRepeatUntil = (val: any) => {
        if (!val) return null;
        // Handles string with time or Date object
        if (typeof val === 'string') return val.slice(0, 10);
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        return val;
      };

      // CRITICAL: Build the payload with proper data consistency
      const eventPayload = {
        title: eventData.user_surname || eventData.title,
        user_surname: eventData.user_surname,
        user_number: eventData.user_number,
        social_network_link: eventData.social_network_link,
        event_notes: eventData.event_notes,
        event_name: eventData.event_name,
        start_date: formatDateForSQL(eventData.start_date || ''),
        end_date: formatDateForSQL(eventData.end_date || ''),
        payment_status: eventData.payment_status || 'not_paid',
        payment_amount: eventData.payment_amount?.toString() || '',
        type: eventData.type || 'event',
        is_recurring: !!eventData.is_recurring,
        repeat_pattern: eventData.is_recurring ? eventData.repeat_pattern : null,
        repeat_until: eventData.is_recurring ? formatRepeatUntil(eventData.repeat_until) : null
      };

      console.log("🔄 FINAL event payload being sent to database:", eventPayload);
      
      // Special debug for recurring events
      if (eventData.is_recurring) {
        console.log("🔄 RECURRING EVENT DEBUG:", {
          is_recurring: eventPayload.is_recurring,
          repeat_pattern: eventPayload.repeat_pattern,
          repeat_until: eventPayload.repeat_until,
          start_date: eventPayload.start_date,
          user_id: user.id
        });
      }

      // Use the database function for atomic operations
      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: eventPayload,
        p_additional_persons: [], // No additional persons for direct creation
        p_user_id: user.id,
        p_event_id: null
      });

      if (error) {
        console.error("❌ Database function error:", error);
        throw error;
      }

      console.log("✅ Event created successfully with ID:", savedEventId);
      
      // If it's a recurring event, let's verify the children were created
      if (eventData.is_recurring) {
        console.log("🔍 Checking for child events...");
        setTimeout(async () => {
          const { data: childEvents } = await supabase
            .from('events')
            .select('*')
            .eq('parent_event_id', savedEventId)
            .eq('user_id', user.id);
          
          console.log("👶 Child events created:", childEvents?.length || 0);
          if (childEvents && childEvents.length > 0) {
            console.log("👶 Child events details:", childEvents.map(e => ({
              id: e.id,
              start_date: e.start_date,
              parent_event_id: e.parent_event_id
            })));
          }
        }, 1000);
      }

      // Return a complete CalendarEventType object
      return {
        id: savedEventId,
        title: eventData.user_surname || eventData.title || 'Untitled Event',
        start_date: eventPayload.start_date || new Date().toISOString(),
        end_date: eventPayload.end_date || new Date().toISOString(),
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

      // Ensure proper date formatting
      const formatDateForSQL = (dateStr: string) => {
        if (!dateStr) return null;
        try {
          const date = new Date(dateStr);
          return date.toISOString();
        } catch (error) {
          console.error("Error formatting date for SQL:", error);
          return dateStr;
        }
      };

      // CRITICAL: Ensure repeat_until is YYYY-MM-DD format
      const formatRepeatUntil = (val: any) => {
        if (!val) return null;
        // Handles string with time or Date object
        if (typeof val === 'string') return val.slice(0, 10);
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        return val;
      };

      const eventPayload = {
        title: eventData.user_surname || eventData.title,
        user_surname: eventData.user_surname,
        user_number: eventData.user_number,
        social_network_link: eventData.social_network_link,
        event_notes: eventData.event_notes,
        event_name: eventData.event_name,
        start_date: formatDateForSQL(eventData.start_date || ''),
        end_date: formatDateForSQL(eventData.end_date || ''),
        payment_status: eventData.payment_status || 'not_paid',
        payment_amount: eventData.payment_amount?.toString() || '',
        type: eventData.type || 'event',
        is_recurring: !!eventData.is_recurring,
        repeat_pattern: eventData.is_recurring ? eventData.repeat_pattern : null,
        repeat_until: eventData.is_recurring ? formatRepeatUntil(eventData.repeat_until) : null
      };

      // Use the database function for atomic operations
      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: eventPayload,
        p_additional_persons: [], // Additional persons handled in EventDialog
        p_user_id: user.id,
        p_event_id: eventData.id
      });

      if (error) throw error;

      // Return a complete CalendarEventType object
      return {
        id: savedEventId,
        title: eventData.user_surname || eventData.title || 'Untitled Event',
        start_date: eventPayload.start_date || new Date().toISOString(),
        end_date: eventPayload.end_date || new Date().toISOString(),
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
      console.error("Error updating event:", error);
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

      console.log("🔄 Deleting event:", id, deleteChoice);

      if (deleteChoice === "series") {
        // Use the delete_recurring_series function for series deletion
        const { data, error } = await supabase.rpc('delete_recurring_series', {
          p_event_id: id,
          p_user_id: user.id,
          p_delete_choice: 'series'
        });

        if (error) throw error;
        return { success: true, deletedCount: data };
      } else {
        // Single event deletion
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;
        return { success: true };
      }
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
      console.error("Error deleting event:", error);
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
