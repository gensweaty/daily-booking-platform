
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseISO, isBefore, isAfter } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface TimeConflictValidationProps {
  startDate: string;
  endDate: string;
  excludeEventId?: string;
  enabled?: boolean;
}

interface ConflictValidationResult {
  hasConflict: boolean;
  conflicts: Array<{
    type: 'event' | 'booking';
    title: string;
    start: string;
    end: string;
  }>;
}

export const useTimeConflictValidation = ({
  startDate,
  endDate,
  excludeEventId,
  enabled = true
}: TimeConflictValidationProps) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['timeConflictValidation', startDate, endDate, excludeEventId, user?.id],
    queryFn: async (): Promise<ConflictValidationResult> => {
      if (!user?.id || !startDate || !endDate) {
        return { hasConflict: false, conflicts: [] };
      }

      const requestStart = parseISO(startDate);
      const requestEnd = parseISO(endDate);

      // Query existing events for the user
      const { data: existingEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, type')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .neq('id', excludeEventId || '');

      if (eventsError) {
        console.error('Error fetching events for conflict check:', eventsError);
        throw eventsError;
      }

      // Query approved booking requests for businesses owned by the user
      const { data: bookingRequests, error: bookingsError } = await supabase
        .from('booking_requests')
        .select(`
          id,
          requester_name,
          start_date,
          end_date,
          business_profiles!inner(user_id)
        `)
        .eq('business_profiles.user_id', user.id)
        .eq('status', 'approved');

      if (bookingsError) {
        console.error('Error fetching booking requests for conflict check:', bookingsError);
        throw bookingsError;
      }

      const conflicts: Array<{
        type: 'event' | 'booking';
        title: string;
        start: string;
        end: string;
      }> = [];

      // Check conflicts with existing events
      existingEvents?.forEach((event) => {
        const eventStart = parseISO(event.start_date);
        const eventEnd = parseISO(event.end_date);

        // Check for time overlap: events overlap if one starts before the other ends
        const hasOverlap = isBefore(requestStart, eventEnd) && isAfter(requestEnd, eventStart);
        
        if (hasOverlap) {
          conflicts.push({
            type: 'event',
            title: event.title,
            start: event.start_date,
            end: event.end_date
          });
        }
      });

      // Check conflicts with approved booking requests
      bookingRequests?.forEach((booking) => {
        const bookingStart = parseISO(booking.start_date);
        const bookingEnd = parseISO(booking.end_date);

        const hasOverlap = isBefore(requestStart, bookingEnd) && isAfter(requestEnd, bookingStart);
        
        if (hasOverlap) {
          conflicts.push({
            type: 'booking',
            title: booking.requester_name || 'Booking Request',
            start: booking.start_date,
            end: booking.end_date
          });
        }
      });

      return {
        hasConflict: conflicts.length > 0,
        conflicts
      };
    },
    enabled: enabled && !!user?.id && !!startDate && !!endDate,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false
  });
};
