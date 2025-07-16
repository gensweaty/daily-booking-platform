
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUnifiedCalendarEvents, deleteCalendarEvent, clearCalendarCache, broadcastCalendarChange } from '@/services/calendarService';

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchEvents = async (): Promise<CalendarEventType[]> => {
    try {
      // Determine which user's events to fetch
      const targetUserId = businessUserId || user?.id;
      
      if (!targetUserId) {
        console.log("[useCalendarEvents] No user ID available for fetching events");
        return [];
      }

      console.log("[useCalendarEvents] Fetching events for user:", targetUserId, "business:", businessId);

      // Always clear cache before fetching for immediate sync
      clearCalendarCache();

      // Use the unified calendar service
      const { events, bookings } = await getUnifiedCalendarEvents(businessId, targetUserId);
      
      // Combine all events
      const allEvents: CalendarEventType[] = [...events, ...bookings];

      console.log(`[useCalendarEvents] ✅ Loaded ${allEvents.length} total events (${events.length} events + ${bookings.length} bookings)`);
      
      return allEvents;

    } catch (error) {
      console.error("[useCalendarEvents] Error in fetchEvents:", error);
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
    staleTime: 0, // Always consider data stale for immediate sync
    refetchInterval: 1000, // Aggressive 1-second refetch for real-time sync
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useCalendarEvents] Creating event with data:", eventData);

      // Use the database function for atomic operations
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

      // Immediate cache clearing and sync
      clearCalendarCache();
      broadcastCalendarChange();

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
    onSuccess: async () => {
      // Immediate invalidation for real-time sync
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      // Clear cache and broadcast change
      clearCalendarCache();
      broadcastCalendarChange();
      
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error: any) => {
      console.error("[useCalendarEvents] Error creating event:", error);
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

      console.log("[useCalendarEvents] Updating event with data:", eventData);

      // Use the database function for atomic operations
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

      // Immediate cache clearing and sync
      clearCalendarCache();
      broadcastCalendarChange();

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
    onSuccess: async () => {
      // Immediate invalidation for real-time sync
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      // Clear cache and broadcast change
      clearCalendarCache();
      broadcastCalendarChange();
      
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("[useCalendarEvents] Error updating event:", error);
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

      console.log("[useCalendarEvents] Deleting event with immediate sync:", id, deleteChoice);

      // Determine the event type from the current events
      const eventToDelete = events.find(e => e.id === id);
      const eventType = eventToDelete?.type === 'booking_request' ? 'booking_request' : 'event';

      console.log("[useCalendarEvents] Determined event type:", eventType, "for event:", eventToDelete);

      // Use the unified delete function with immediate sync
      await deleteCalendarEvent(id, eventType, user.id);

      // Immediate cache clearing and broadcast
      clearCalendarCache();
      broadcastCalendarChange();

      return { success: true };
    },
    onSuccess: async () => {
      console.log("[useCalendarEvents] Delete mutation succeeded - immediate sync");
      
      // Immediate cache clearing and broadcast
      clearCalendarCache();
      broadcastCalendarChange();
      
      // Immediate invalidation for real-time sync
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      // Also invalidate any potential external calendar queries
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error("[useCalendarEvents] Error deleting event:", error);
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
