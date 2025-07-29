
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseISO, isBefore, isAfter, isEqual } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface TimeConflictValidationProps {
  startDate: string;
  endDate: string;
  excludeEventId?: string;
  enabled?: boolean;
}

interface ConflictEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  type: string;
}

interface ConflictValidationResult {
  hasConflict: boolean;
  conflicts: ConflictEvent[];
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

      const conflicts: ConflictEvent[] = [];

      // Check conflicts with existing events
      existingEvents?.forEach((event) => {
        const eventStart = parseISO(event.start_date);
        const eventEnd = parseISO(event.end_date);

        // Check for time overlap: events overlap if one starts before the other ends
        const hasOverlap = isBefore(requestStart, eventEnd) && isAfter(requestEnd, eventStart);
        
        if (hasOverlap) {
          conflicts.push({
            id: event.id,
            title: event.title,
            start_date: event.start_date,
            end_date: event.end_date,
            type: event.type || 'event'
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
            id: booking.id,
            title: booking.requester_name || 'Booking Request',
            start_date: booking.start_date,
            end_date: booking.end_date,
            type: 'booking_request'
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
