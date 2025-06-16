
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';

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
}

interface OptimizedBookingRequest {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  business_id: string;
  created_at: string;
}

export const useOptimizedCalendarEvents = (userId: string | undefined, currentDate: Date) => {
  // Calculate date range for current month only
  const monthStart = startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const monthEnd = endOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));

  return useQuery({
    queryKey: ['optimized-calendar-events', userId, format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!userId) return { events: [], bookingRequests: [] };

      // Fetch only essential fields for events
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
          created_at
        `)
        .eq('user_id', userId)
        .gte('start_date', monthStart.toISOString())
        .lte('start_date', monthEnd.toISOString())
        .is('deleted_at', null)
        .order('start_date', { ascending: true })
        .limit(100); // Reasonable limit

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
          status,
          business_id,
          created_at
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

      return {
        events: (events as OptimizedEvent[]) || [],
        bookingRequests: (bookingRequests as OptimizedBookingRequest[]) || []
      };
    },
    enabled: !!userId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};
