
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

      console.log("Fetching events for user:", targetUserId, "business:", businessId);

      // Fetch events from the events table (now includes recurring instances as real records)
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
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
          console.error("Error fetching booking requests:", bookingsError);
        } else {
          bookingRequests = bookings || [];
        }
      }

      // Convert all data to CalendarEventType format
      const allEvents: CalendarEventType[] = [];

      // Add regular events (including recurring instances)
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
          parent_event_id: event.parent_event_id,
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

      console.log(`✅ Loaded ${allEvents.length} total events (${events?.length || 0} events + ${bookingRequests.length} bookings)`);
      return allEvents;

    } catch (error) {
      console.error("Error in fetchEvents:", error);
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

      console.log("🔍 useCalendarEvents - Creating event with data:", eventData);

      // STEP 2: Defensive Fix - Ensure title is never empty with proper fallback
      const eventTitle = (eventData.title || eventData.user_surname || "Untitled Event").trim();
      const safeUserSurname = (eventData.user_surname || eventTitle).trim();

      // STEP 2: Defensive Fix - Ensure repeat_until is always a string in YYYY-MM-DD format
      let safeRepeatUntil = null;
      if (eventData.is_recurring && eventData.repeat_until) {
        if (typeof eventData.repeat_until === "string") {
          safeRepeatUntil = eventData.repeat_until;
        } else {
          safeRepeatUntil = new Date(eventData.repeat_until).toISOString().slice(0, 10);
        }
      }

      // STEP 2: Defensive Fix - Ensure repeat_pattern is never "none" when recurring
      const safeRepeatPattern = eventData.is_recurring && eventData.repeat_pattern !== "none" ? eventData.repeat_pattern : null;

      // Prepare event data with proper recurring settings
      const preparedEventData = {
        title: eventTitle,
        user_surname: safeUserSurname,
        user_number: eventData.user_number || "",
        social_network_link: eventData.social_network_link || "",
        event_notes: eventData.event_notes || "",
        event_name: eventData.event_name || "",
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        payment_status: eventData.payment_status || 'not_paid',
        payment_amount: eventData.payment_amount?.toString() || null,
        type: eventData.type || 'event',
        is_recurring: eventData.is_recurring || false,
        repeat_pattern: safeRepeatPattern,
        repeat_until: safeRepeatUntil
      };

      console.log("🔍 useCalendarEvents - Prepared event data for RPC:", preparedEventData);

      // Use the database function for atomic operations with JSON stringification
      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: JSON.stringify(preparedEventData),
        p_additional_persons: JSON.stringify([]), // No additional persons for direct creation
        p_user_id: user.id,
        p_event_id: null
      });

      if (error) {
        console.error("🚨 useCalendarEvents - RPC Error Details:", {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code
        });
        throw error;
      }

      console.log("✅ useCalendarEvents - Event created successfully with ID:", savedEventId);

      // Return a complete CalendarEventType object
      return {
        id: savedEventId,
        title: eventTitle,
        start_date: eventData.start_date || new Date().toISOString(),
        end_date: eventData.end_date || new Date().toISOString(),
        user_id: user.id,
        type: eventData.type || 'event',
        created_at: new Date().toISOString(),
        ...eventData,
        user_surname: safeUserSurname,
        is_recurring: eventData.is_recurring || false,
        repeat_pattern: safeRepeatPattern,
        repeat_until: safeRepeatUntil
      } as CalendarEventType;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      const eventTypeMessage = variables.is_recurring ? "recurring event series" : "event";
      toast({
        title: "Success",
        description: `${eventTypeMessage} created successfully`,
      });
    },
    onError: (error: any) => {
      console.error("🚨 useCalendarEvents - Error creating event:", error);
      
      let errorMessage = "Failed to create event";
      if (error?.message) {
        errorMessage = error.message;
      }
      if (error?.details) {
        errorMessage += " (" + error.details + ")";
      }
      if (error?.hint) {
        errorMessage += " Hint: " + error.hint;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType> & { id: string }) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("🔍 useCalendarEvents - Updating event with data:", eventData);

      // STEP 2: Defensive Fix - Ensure title is never empty with proper fallback
      const eventTitle = (eventData.title || eventData.user_surname || "Untitled Event").trim();
      const safeUserSurname = (eventData.user_surname || eventTitle).trim();

      // STEP 2: Defensive Fix - Ensure repeat_until is always a string in YYYY-MM-DD format
      let safeRepeatUntil = null;
      if (eventData.is_recurring && eventData.repeat_until) {
        if (typeof eventData.repeat_until === "string") {
          safeRepeatUntil = eventData.repeat_until;
        } else {
          safeRepeatUntil = new Date(eventData.repeat_until).toISOString().slice(0, 10);
        }
      }

      // STEP 2: Defensive Fix - Ensure repeat_pattern is never "none" when recurring
      const safeRepeatPattern = eventData.is_recurring && eventData.repeat_pattern !== "none" ? eventData.repeat_pattern : null;

      // Prepare event data with proper recurring settings
      const preparedEventData = {
        title: eventTitle,
        user_surname: safeUserSurname,
        user_number: eventData.user_number || "",
        social_network_link: eventData.social_network_link || "",
        event_notes: eventData.event_notes || "",
        event_name: eventData.event_name || "",
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        payment_status: eventData.payment_status || 'not_paid',
        payment_amount: eventData.payment_amount?.toString() || null,
        type: eventData.type || 'event',
        is_recurring: eventData.is_recurring || false,
        repeat_pattern: safeRepeatPattern,
        repeat_until: safeRepeatUntil
      };

      // Use the database function for atomic operations with JSON stringification
      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: JSON.stringify(preparedEventData),
        p_additional_persons: JSON.stringify([]), // Additional persons handled in EventDialog
        p_user_id: user.id,
        p_event_id: eventData.id
      });

      if (error) {
        console.error("🚨 useCalendarEvents - RPC Error Details:", {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code
        });
        throw error;
      }

      return {
        id: savedEventId,
        title: eventTitle,
        start_date: eventData.start_date || new Date().toISOString(),
        end_date: eventData.end_date || new Date().toISOString(),
        user_id: user.id,
        type: eventData.type || 'event',
        created_at: eventData.created_at || new Date().toISOString(),
        ...eventData,
        user_surname: safeUserSurname,
        is_recurring: eventData.is_recurring || false,
        repeat_pattern: safeRepeatPattern,
        repeat_until: safeRepeatUntil
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
      console.error("🚨 useCalendarEvents - Error updating event:", error);
      
      let errorMessage = "Failed to update event";
      if (error?.message) {
        errorMessage = error.message;
      }
      if (error?.details) {
        errorMessage += " (" + error.details + ")";
      }
      if (error?.hint) {
        errorMessage += " Hint: " + error.hint;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("🔍 useCalendarEvents - Deleting event:", id, deleteChoice);

      // Use the new delete function for recurring events
      const { data: deletedCount, error } = await supabase.rpc('delete_recurring_series', {
        p_event_id: id,
        p_user_id: user.id,
        p_delete_choice: deleteChoice || 'this'
      });

      if (error) {
        console.error("🚨 useCalendarEvents - Delete RPC Error Details:", {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code
        });
        throw error;
      }

      return { success: true, deletedCount };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      const deleteChoice = variables.deleteChoice || 'this';
      const message = deleteChoice === 'series' 
        ? `Deleted ${data.deletedCount} events from the series`
        : "Event deleted successfully";
      
      toast({
        title: "Success",
        description: message,
      });
    },
    onError: (error: any) => {
      console.error("🚨 useCalendarEvents - Error deleting event:", error);
      
      let errorMessage = "Failed to delete event";
      if (error?.message) {
        errorMessage = error.message;
      }
      if (error?.details) {
        errorMessage += " (" + error.details + ")";
      }
      if (error?.hint) {
        errorMessage += " Hint: " + error.hint;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
