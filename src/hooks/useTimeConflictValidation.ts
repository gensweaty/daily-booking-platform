
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarEventType } from "@/lib/types/calendar";

interface TimeConflictCheckParams {
  startDate: string;
  endDate: string;
  excludeEventId?: string;
  enabled?: boolean;
}

export const useTimeConflictValidation = ({
  startDate,
  endDate,
  excludeEventId,
  enabled = false
}: TimeConflictCheckParams) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['time-conflict-check', startDate, endDate, excludeEventId, user?.id],
    queryFn: async () => {
      if (!user?.id) return { hasConflict: false, conflicts: [] };

      const conflicts: Array<{ type: 'event' | 'booking'; title: string; start: string; end: string }> = [];

      // Check for existing events
      const { data: existingEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, user_surname')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .neq('id', excludeEventId || '')
        .overlaps('start_date', 'end_date', `[${startDate},${endDate})`);

      if (eventsError) {
        console.error('Error checking event conflicts:', eventsError);
      } else if (existingEvents && existingEvents.length > 0) {
        existingEvents.forEach(event => {
          conflicts.push({
            type: 'event',
            title: event.user_surname || event.title || 'Untitled Event',
            start: event.start_date,
            end: event.end_date
          });
        });
      }

      // Check for approved booking requests for businesses owned by this user
      const { data: businessProfiles, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id);

      if (!businessError && businessProfiles && businessProfiles.length > 0) {
        const businessIds = businessProfiles.map(bp => bp.id);
        
        const { data: approvedBookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('id, title, start_date, end_date, requester_name')
          .in('business_id', businessIds)
          .eq('status', 'approved')
          .is('deleted_at', null)
          .overlaps('start_date', 'end_date', `[${startDate},${endDate})`);

        if (bookingsError) {
          console.error('Error checking booking conflicts:', bookingsError);
        } else if (approvedBookings && approvedBookings.length > 0) {
          approvedBookings.forEach(booking => {
            conflicts.push({
              type: 'booking',
              title: booking.requester_name || booking.title || 'Booking Request',
              start: booking.start_date,
              end: booking.end_date
            });
          });
        }
      }

      return {
        hasConflict: conflicts.length > 0,
        conflicts
      };
    },
    enabled: enabled && !!user?.id && !!startDate && !!endDate,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });
};
