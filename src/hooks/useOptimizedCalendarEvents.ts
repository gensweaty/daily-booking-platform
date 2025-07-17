import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useEffect } from 'react';
import { clearCalendarCache } from '@/services/calendarService';

interface OptimizedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  user_id: string;
  payment_status?: string;
  payment_amount?: number;
  type?: string;
  created_at: string;
  deleted_at?: string;
  booking_request_id?: string;
  user_surname?: string;
}

interface OptimizedBookingRequest {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  business_id: string;
  created_at: string;
  deleted_at?: string;
  requester_name?: string;
}

export const useOptimizedCalendarEvents = (userId: string | undefined, currentDate: Date) => {
  const queryClient = useQueryClient();
  
  // Calculate date range for current month only
  const monthStart = startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const monthEnd = endOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));

  const queryKey = ['optimized-calendar-events', userId, format(currentDate, 'yyyy-MM')];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) return { events: [], bookingRequests: [] };

      // Fetch only essential fields for events - STRICT deleted_at filtering
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_date,
          end_date,
          user_id,
          payment_status,
          payment_amount,
          type,
          created_at,
          deleted_at,
          booking_request_id,
          user_surname
        `)
        .eq('user_id', userId)
        .gte('start_date', monthStart.toISOString())
        .lte('start_date', monthEnd.toISOString())
        .is('deleted_at', null)
        .order('start_date', { ascending: true })
        .limit(100);

      if (eventsError) {
        console.error('Error fetching optimized events:', eventsError);
        throw eventsError;
      }

      // Fetch booking requests with minimal fields - STRICT deleted_at filtering
      const { data: bookingRequests, error: bookingError } = await supabase
        .from('booking_requests')
        .select(`
          id,
          title,
          start_date,
          end_date,
          status,
          business_id,
          created_at,
          deleted_at,
          requester_name
        `)
        .eq('user_id', userId)
        .gte('start_date', monthStart.toISOString())
        .lte('start_date', monthEnd.toISOString())
        .is('deleted_at', null)
        .order('start_date', { ascending: true })
        .limit(50);

      if (bookingError) {
        console.error('Error fetching booking requests:', bookingError);
        throw bookingError;
      }

      // Filter out any deleted events as a final safety check
      const validEvents = (events as OptimizedEvent[])?.filter(event => !event.deleted_at) || [];
      const validBookings = (bookingRequests as OptimizedBookingRequest[])?.filter(booking => !booking.deleted_at) || [];

      // Enhanced deduplication logic
      const eventIds = new Set(validEvents.map(e => e.id));
      const eventTimeSlots = new Set(validEvents.map(e => 
        `${e.start_date}-${e.end_date}-${e.user_surname || e.title}`
      ));

      // Filter booking requests to avoid duplicates with events
      const uniqueBookings = validBookings.filter(booking => {
        // Don't include if there's already an event with the same ID
        if (eventIds.has(booking.id)) {
          return false;
        }

        // For approved bookings, check if there's a matching event by time slot and name
        if (booking.status === 'approved') {
          const bookingTimeSlot = `${booking.start_date}-${booking.end_date}-${booking.requester_name || booking.title}`;
          if (eventTimeSlots.has(bookingTimeSlot)) {
            return false;
          }
        }

        return true;
      });

      console.log(`[useOptimizedCalendarEvents] Returning ${validEvents.length} events and ${uniqueBookings.length} bookings (optimized and deduplicated)`);

      return {
        events: validEvents,
        bookingRequests: uniqueBookings
      };
    },
    enabled: !!userId,
    staleTime: 0, // Always consider data stale for immediate updates
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 3000, // Moderate polling every 3 seconds
    refetchIntervalInBackground: false, // Prevent background refetch to avoid loading indicators
  });

  // Debounced event handlers to prevent excessive calls
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const debouncedInvalidate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
      }, 100);
    };

    const handleCacheInvalidation = () => {
      console.log('[useOptimizedCalendarEvents] Cache invalidation detected, refetching...');
      debouncedInvalidate();
    };

    const handleEventDeletion = (event: CustomEvent) => {
      console.log('[useOptimizedCalendarEvents] Event deletion detected:', event.detail);
      debouncedInvalidate();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'calendar_invalidation_signal' || event.key === 'calendar_event_deleted') {
        console.log('[useOptimizedCalendarEvents] Cross-tab sync detected, refetching...');
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
  }, [queryClient, queryKey]);

  // Optimized real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    console.log('[useOptimizedCalendarEvents] Setting up real-time subscriptions');

    let debounceTimer: NodeJS.Timeout;

    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        clearCalendarCache();
        queryClient.invalidateQueries({ queryKey });
      }, 200);
    };

    // Subscribe to events table changes
    const eventsChannel = supabase
      .channel(`optimized_events_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useOptimizedCalendarEvents] Events table changed:', payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to booking_requests table changes
    const bookingsChannel = supabase
      .channel(`optimized_bookings_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useOptimizedCalendarEvents] Booking requests table changed:', payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      console.log('[useOptimizedCalendarEvents] Cleaning up real-time subscriptions');
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [userId, queryClient, queryKey]);

  return query;
};
