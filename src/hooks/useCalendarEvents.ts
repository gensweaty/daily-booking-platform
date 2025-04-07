
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarEventType } from "@/lib/types/calendar";

export const useCalendarEvents = () => {
  const { user } = useAuth();
  
  const fetchEvents = async (): Promise<CalendarEventType[]> => {
    if (!user) return [];
    
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);
        
      if (error) throw error;
      
      // Fetch files for each event
      const eventsWithFiles = await Promise.all(
        (events || []).map(async (event) => {
          const { data: files, error: filesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', event.id);
            
          if (filesError) {
            console.error("Error fetching files for event:", event.id, filesError);
            return {
              ...event,
              has_files: false,
              files: []
            };
          }
          
          return {
            ...event,
            has_files: files && files.length > 0,
            files: files || []
          };
        })
      );
      
      return eventsWithFiles || [];
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  };

  const getApprovedBookings = async (): Promise<CalendarEventType[]> => {
    if (!user) return [];
    
    try {
      // Get the user's business_profile
      const { data: businessProfile, error: profileError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileError) throw profileError;
      if (!businessProfile) return [];
      
      // Fetch approved booking requests
      const { data: bookings, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessProfile.id)
        .eq('status', 'approved');
        
      if (error) throw error;
      
      // Fetch files for each booking and map to CalendarEventType
      const bookingsWithFiles = await Promise.all(
        (bookings || []).map(async (booking) => {
          // Get files associated with this booking
          const { data: files, error: filesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', booking.id);
            
          if (filesError) {
            console.error("Error fetching files for booking:", booking.id, filesError);
          }
          
          const bookingEvent: CalendarEventType = {
            id: booking.id,
            title: booking.title,
            start_date: booking.start_date,
            end_date: booking.end_date,
            user_id: booking.user_id || '',
            created_at: booking.created_at,
            type: 'booking_request',
            user_surname: booking.requester_name,
            user_number: booking.requester_phone,
            social_network_link: booking.requester_email,
            event_notes: booking.description,
            payment_status: booking.payment_status,
            payment_amount: booking.payment_amount || undefined,
            has_files: files && files.length > 0,
            files: files || []
          };
          
          return bookingEvent;
        })
      );
      
      return bookingsWithFiles || [];
    } catch (error) {
      console.error("Error fetching approved bookings:", error);
      throw error;
    }
  };

  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    enabled: !!user,
  });

  const { data: approvedBookings = [], isLoading: bookingsLoading, error: bookingsError } = useQuery({
    queryKey: ['approved-bookings'],
    queryFn: getApprovedBookings,
    enabled: !!user,
  });

  // Combine regular events and approved bookings
  const allEvents = [...events, ...approvedBookings];

  return {
    events: allEvents,
    isLoading: eventsLoading || bookingsLoading,
    error: eventsError || bookingsError,
  };
};
