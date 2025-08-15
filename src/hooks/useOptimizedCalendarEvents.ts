import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useEffect, useCallback } from 'react';
import { clearCalendarCache } from '@/services/calendarService';
import { advancedPerformanceOptimizer } from '@/utils/advancedPerformanceOptimizer';
import { useConsolidatedCalendarSubscription } from '@/hooks/useOptimizedSubscriptions';

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

      // Check smart cache first
      const cacheKey = `calendar_events_${userId}_${format(currentDate, 'yyyy-MM')}`;
      const cached = advancedPerformanceOptimizer.getFromSmartCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch only essential fields for events - STRICT deleted_at filtering
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_date,
          end_date,
          payment_status,
          type
        `)
        .eq('user_id', userId)
        .gte('start_date', monthStart.toISOString())
        .lte('start_date', monthEnd.toISOString())
        .is('deleted_at', null)
        .order('start_date', { ascending: true })
        .limit(50); // Reduced from 100

      if (eventsError) {
        console.error('Error fetching optimized events:', eventsError);
        throw eventsError;
      }

      // Fetch booking requests with minimal fields
      const { data: bookingRequests, error: bookingError } = await supabase
        .from('booking_requests')
        .select(`
          id,
          title,
          start_date,
          end_date,
          status
        `)
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', monthStart.toISOString())
        .lte('start_date', monthEnd.toISOString())
        .is('deleted_at', null)
        .order('start_date', { ascending: true })
        .limit(25); // Reduced from 50

      if (bookingError) {
        console.error('Error fetching booking requests:', bookingError);
        throw bookingError;
      }

      // Optimize data structures
      const optimizedEvents = advancedPerformanceOptimizer.optimizeDataStructure(
        events || [],
        ['id', 'title', 'start_date', 'end_date', 'payment_status', 'type']
      );
      
      const optimizedBookings = advancedPerformanceOptimizer.optimizeDataStructure(
        bookingRequests || [],
        ['id', 'title', 'start_date', 'end_date', 'status']
      );

      // Filter out duplicates
      const eventIds = new Set(optimizedEvents.map(e => e.id));
      const uniqueBookings = optimizedBookings.filter(booking => !eventIds.has(booking.id));

      const result = {
        events: optimizedEvents,
        bookingRequests: uniqueBookings
      };

      // Cache the result
      advancedPerformanceOptimizer.setSmartCache(cacheKey, result, 3); // 3 minutes

      return result;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes instead of 0
    gcTime: 3 * 60 * 1000, // 3 minutes instead of 5
    refetchOnWindowFocus: false, // Disabled to reduce queries
    refetchOnMount: false, // Disabled to reduce queries
    refetchInterval: 5000, // Increased from 3000 to 5000
    refetchIntervalInBackground: false,
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

  // Use consolidated subscriptions for better performance
  const { subscriptionCount } = useConsolidatedCalendarSubscription(
    userId,
    useCallback(() => {
      clearCalendarCache();
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey])
  );

  return query;
};
