
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUnifiedCalendarEvents, deleteCalendarEvent, clearCalendarCache } from '@/services/calendarService';
import { useEffect } from 'react';

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchEvents = async (): Promise<CalendarEventType[]> => {
    try {
      const targetUserId = businessUserId || user?.id;
      
      if (!targetUserId) {
        console.log("[useCalendarEvents] No user ID available for fetching events");
        return [];
      }

      console.log("[useCalendarEvents] Fetching events for user:", targetUserId, "business:", businessId);

      // Use the unified calendar service for consistency
      const { events, bookings } = await getUnifiedCalendarEvents(businessId, targetUserId);
      
      // Combine all events and ensure no duplicates
      const allEvents: CalendarEventType[] = [...events, ...bookings];
      
      // Additional deduplication by ID to ensure no duplicates
      const uniqueEvents = allEvents.filter((event, index, self) => 
        index === self.findIndex(e => e.id === event.id)
      );

      if (uniqueEvents.length !== allEvents.length) {
        console.warn(`[useCalendarEvents] Removed ${allEvents.length - uniqueEvents.length} duplicate events`);
      }

      console.log(`[useCalendarEvents] ✅ Loaded ${uniqueEvents.length} unique events (${events.length} events + ${bookings.length} approved bookings)`);
      
      return uniqueEvents;

    } catch (error) {
      console.error("[useCalendarEvents] Error in fetchEvents:", error);
      throw error;
    }
  };

  // Unified query key strategy - use business-specific keys when applicable
  const getQueryKey = () => {
    if (businessId && businessUserId) {
      return ['unified-calendar-events', businessId, businessUserId];
    }
    return ['events', user?.id];
  };

  const queryKey = getQueryKey();

  const {
    data: events = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: fetchEvents,
    enabled: !!(businessUserId || user?.id),
    staleTime: 1000, // Consider data stale after 1 second for immediate updates
    gcTime: 5000, // Keep in cache for 5 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Enhanced cache invalidation with unified approach
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const debouncedInvalidate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[useCalendarEvents] Invalidating unified queries and refetching...');
        
        // Invalidate ALL related calendar queries
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['business-events'] });
        queryClient.invalidateQueries({ queryKey: ['unified-calendar-events'] });
        queryClient.invalidateQueries({ queryKey: ['optimized-calendar-events'] });
        
        // Force refetch
        refetch();
      }, 100);
    };

    const handleCacheInvalidation = (event?: CustomEvent) => {
      console.log('[useCalendarEvents] Cache invalidation detected:', event?.detail);
      debouncedInvalidate();
    };

    const handleEventDeletion = (event: CustomEvent) => {
      console.log('[useCalendarEvents] Event deletion detected:', event.detail);
      if (event.detail.verified && event.detail.source === 'unified_deletion') {
        console.log('[useCalendarEvents] Verified unified deletion, forcing immediate refresh');
        debouncedInvalidate();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'calendar_invalidation_signal' || event.key === 'calendar_event_deleted') {
        console.log('[useCalendarEvents] Cross-tab sync detected');
        try {
          const data = JSON.parse(event.newValue || '{}');
          if (data.source === 'unified_deletion') {
            console.log('[useCalendarEvents] Cross-tab unified deletion detected');
            debouncedInvalidate();
          }
        } catch (e) {
          console.warn('[useCalendarEvents] Error parsing storage event:', e);
          debouncedInvalidate();
        }
      }
    };

    window.addEventListener('calendar-cache-invalidated', handleCacheInvalidation as EventListener);
    window.addEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('calendar-cache-invalidated', handleCacheInvalidation as EventListener);
      window.removeEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [queryClient, queryKey, refetch]);

  // Enhanced real-time subscriptions with unified approach
  useEffect(() => {
    if (!user?.id && !businessUserId) return;

    const targetUserId = businessUserId || user?.id;
    if (!targetUserId) return;

    console.log('[useCalendarEvents] Setting up unified real-time subscriptions');

    let debounceTimer: NodeJS.Timeout;

    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[useCalendarEvents] Real-time update triggered');
        clearCalendarCache();
        
        // Invalidate all related queries
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['business-events'] });
        queryClient.invalidateQueries({ queryKey: ['unified-calendar-events'] });
        queryClient.invalidateQueries({ queryKey: ['optimized-calendar-events'] });
        
        refetch();
      }, 200);
    };

    // Subscribe to events table changes
    const eventsChannel = supabase
      .channel(`unified_events_${targetUserId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${targetUserId}`
        },
        (payload) => {
          console.log('[useCalendarEvents] Events table changed:', payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to booking_requests table changes for the business
    let bookingsChannel: any = null;
    if (businessId) {
      bookingsChannel = supabase
        .channel(`unified_bookings_${businessId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'booking_requests',
            filter: `business_id=eq.${businessId}`
          },
          (payload) => {
            console.log('[useCalendarEvents] Booking requests table changed:', payload);
            debouncedUpdate();
          }
        )
        .subscribe();
    }

    return () => {
      clearTimeout(debounceTimer);
      console.log('[useCalendarEvents] Cleaning up unified real-time subscriptions');
      supabase.removeChannel(eventsChannel);
      if (bookingsChannel) {
        supabase.removeChannel(bookingsChannel);
      }
    };
  }, [user?.id, businessUserId, businessId, queryClient, queryKey, refetch]);

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useCalendarEvents] Creating event with data:", eventData);

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
        p_additional_persons: [],
        p_user_id: user.id,
        p_event_id: null
      });

      if (error) throw error;

      clearCalendarCache();

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
      await new Promise(resolve => setTimeout(resolve, 300));
      // Invalidate all unified calendar queries
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['unified-calendar-events'] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
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

      // Check if this is a booking_request (type === 'booking_request') or regular event
      if (eventData.type === 'booking_request') {
        // Update booking_request table
        const { error } = await supabase
          .from('booking_requests')
          .update({
            title: eventData.user_surname || eventData.title,
            requester_name: eventData.user_surname || eventData.title,
            requester_phone: eventData.user_number,
            requester_email: eventData.social_network_link,
            description: eventData.event_notes,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            payment_status: eventData.payment_status || 'not_paid',
            payment_amount: eventData.payment_amount || null,
          })
          .eq('id', eventData.id);

        if (error) throw error;

        clearCalendarCache();

        return {
          ...eventData,
          title: eventData.user_surname || eventData.title || 'Untitled Event',
        } as CalendarEventType;
      } else {
        // Update regular event using the existing RPC function
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
          p_additional_persons: [],
          p_user_id: user.id,
          p_event_id: eventData.id
        });

        if (error) throw error;

        clearCalendarCache();

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
      }
    },
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      // Invalidate all unified calendar queries
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['unified-calendar-events'] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
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

  // Enhanced delete mutation with unified approach
  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useCalendarEvents] Starting unified deletion process for event:", id);

      // Find the event in current events to determine type
      const eventToDelete = events.find(e => e.id === id);
      
      if (!eventToDelete) {
        console.error("[useCalendarEvents] Event not found in current events list:", id);
        throw new Error("Event not found");
      }
      
      const eventType = eventToDelete.type === 'booking_request' ? 'booking_request' : 'event';

      console.log("[useCalendarEvents] Determined event type:", eventType, "for event:", eventToDelete.title);

      // Use the enhanced unified delete function
      const result = await deleteCalendarEvent(id, eventType, user.id);

      console.log("[useCalendarEvents] ✅ Unified deletion completed successfully");

      return { ...result, title: eventToDelete.title };
    },
    onSuccess: async (result) => {
      console.log("[useCalendarEvents] Delete mutation succeeded:", result);
      
      // Immediate cache clearing and query invalidation
      clearCalendarCache();
      
      // Invalidate ALL related queries immediately
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['unified-calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-calendar-events'] });
      
      // Force immediate refetch
      await refetch();
      
      toast({
        title: "Success",
        description: `${result.eventType === 'booking_request' ? 'Booking request' : 'Event'} "${result.title}" deleted successfully`,
      });
    },
    onError: (error: any) => {
      console.error("[useCalendarEvents] Delete mutation failed:", error);
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
