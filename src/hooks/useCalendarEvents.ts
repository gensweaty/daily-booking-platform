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

      // Use the unified calendar service for consistency - this will fetch both events and approved bookings
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

  const queryKey = businessId ? ['business-events', businessId] : ['events', user?.id];

  const {
    data: events = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: fetchEvents,
    enabled: !!(businessUserId || user?.id),
    staleTime: 0, // Always consider data stale for immediate updates
    gcTime: 1000, // Keep in cache for 1 second only
    refetchInterval: 1500, // Moderate polling every 1.5 seconds
    refetchIntervalInBackground: false, // Disable background refetch to avoid visible loading
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Debounced cache invalidation to prevent excessive calls
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const debouncedInvalidate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
        refetch();
      }, 50);
    };

    const handleCacheInvalidation = () => {
      console.log('[useCalendarEvents] Cache invalidation detected, refetching...');
      debouncedInvalidate();
    };

    const handleEventDeletion = (event: CustomEvent) => {
      console.log('[useCalendarEvents] Event deletion detected:', event.detail);
      debouncedInvalidate();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'calendar_invalidation_signal' || event.key === 'calendar_event_deleted') {
        console.log('[useCalendarEvents] Cross-tab sync detected, refetching...');
        debouncedInvalidate();
      }
    };

    window.addEventListener('calendar-cache-invalidated', handleCacheInvalidation);
    window.addEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('calendar-cache-invalidated', handleCacheInvalidation);
      window.removeEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [queryClient, queryKey, refetch]);

  // Enhanced real-time subscriptions for both events and booking_requests
  useEffect(() => {
    if (!user?.id && !businessUserId) return;

    const targetUserId = businessUserId || user?.id;
    if (!targetUserId) return;

    console.log('[useCalendarEvents] Setting up real-time subscriptions for both events and bookings');

    let debounceTimer: NodeJS.Timeout;

    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        clearCalendarCache();
        queryClient.invalidateQueries({ queryKey });
        refetch();
      }, 100);
    };

    // Subscribe to events table changes
    const eventsChannel = supabase
      .channel(`calendar_events_${targetUserId}_${Date.now()}`)
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
        .channel(`calendar_bookings_${businessId}_${Date.now()}`)
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
      console.log('[useCalendarEvents] Cleaning up real-time subscriptions');
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
        p_event_id: null,
        p_created_by_type: 'admin',
        p_created_by_name: user.email || 'User',
        p_last_edited_by_type: 'admin',
        p_last_edited_by_name: user.email || 'User'
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
          p_event_id: eventData.id,
          p_created_by_type: 'admin',
          p_created_by_name: user.email || 'User',
          p_last_edited_by_type: 'admin',
          p_last_edited_by_name: user.email || 'User'
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

      console.log("[useCalendarEvents] Deleting event:", id, deleteChoice);

      // Determine the event type from the current events
      const eventToDelete = events.find(e => e.id === id);
      let eventType: 'event' | 'booking_request' = 'event';
      
      if (eventToDelete?.type === 'booking_request') {
        eventType = 'booking_request';
        console.log("[useCalendarEvents] Detected booking request for deletion");
      } else {
        // Double-check by querying the database directly
        const { data: bookingCheck } = await supabase
          .from('booking_requests')
          .select('id')
          .eq('id', id)
          .single();
          
        if (bookingCheck) {
          eventType = 'booking_request';
          console.log("[useCalendarEvents] Found booking request in database for deletion");
        }
      }

      console.log("[useCalendarEvents] Final event type for deletion:", eventType);

      // Use the enhanced unified delete function
      await deleteCalendarEvent(id, eventType, user.id);

      return { success: true };
    },
    onSuccess: async () => {
      console.log("[useCalendarEvents] Delete mutation success, triggering immediate refresh");
      
      // Immediate cache invalidation and refetch
      clearCalendarCache();
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      }
      
      // Force immediate refetch with a small delay
      setTimeout(() => {
        refetch();
      }, 100);
      
      // Broadcast the deletion event
      window.dispatchEvent(new CustomEvent('calendar-event-deleted', {
        detail: { timestamp: Date.now() }
      }));
      
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
