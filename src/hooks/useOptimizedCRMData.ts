import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useOptimizedCRMData = (userId: string | undefined, dateRange: { start: Date; end: Date }) => {
  const { data: combinedData, isLoading } = useQuery({
    queryKey: ['optimized-customers', userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!userId) return [];

      console.log('Fetching CRM data for user:', userId, 'date range:', dateRange);

      const startDateStr = dateRange.start.toISOString();
      const endDateStr = dateRange.end.toISOString();

      // Get standalone customers (not linked to events) - filter by CUSTOMER created_at date
      const { data: standaloneCustomers, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          customer_files_new(*)
        `)
        .eq('user_id', userId)
        .is('event_id', null)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (customersError) {
        console.error('Error fetching standalone customers:', customersError);
      }

      // Get events in date range (only parent events to avoid duplicates)
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_files(*)
        `)
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null)
        .is('parent_event_id', null)
        .order('created_at', { ascending: false });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
      }

      // Get approved booking requests in date range
      const { data: bookingRequests, error: bookingRequestsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (bookingRequestsError) {
        console.error('Error fetching booking requests:', bookingRequestsError);
      }

      // Get event customers
      const { data: eventLinkedCustomers, error: eventCustomersError } = await supabase
        .from('customers')
        .select(`
          *,
          customer_files_new(*)
        `)
        .eq('user_id', userId)
        .eq('type', 'customer')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (eventCustomersError) {
        console.error('Error fetching event customers:', eventCustomersError);
      }

      // For each booking request, get its files from event_files table
      const bookingRequestsWithFiles = await Promise.all(
        (bookingRequests || []).map(async (booking) => {
          const { data: eventFiles, error: filesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', booking.id);

          if (filesError) {
            console.error('Error fetching files for booking:', booking.id, filesError);
          }

          return {
            ...booking,
            event_files: eventFiles || []
          };
        })
      );

      // Transform booking requests to match customer structure for CRM display
      const transformedBookingRequests = bookingRequestsWithFiles.map(booking => ({
        ...booking,
        id: `booking-${booking.id}`,
        title: booking.title || booking.user_surname || booking.requester_name,
        user_surname: booking.user_surname || booking.requester_name,
        user_number: booking.requester_phone,
        social_network_link: booking.requester_email,
        event_notes: booking.description,
        source: 'booking_request',
        create_event: true,
        sort_date: booking.created_at,
        // Map event_files to customer_files_new for UI compatibility
        customer_files_new: booking.event_files
      }));

      // Combine all data into a single array to sort by creation date
      const allData = [];

      // Add standalone customers
      (standaloneCustomers || []).forEach(customer => {
        allData.push({
          ...customer,
          source: 'standalone',
          create_event: customer.create_event || false,
          sort_date: customer.created_at
        });
      });

      // Add main persons from events as customers
      (events || []).forEach(event => {
        // For events that were created from booking requests, fetch the files from event_files
        const eventItem = {
          id: `event-${event.id}`,
          title: event.title || event.user_surname,
          user_surname: event.user_surname,
          user_number: event.user_number,
          social_network_link: event.social_network_link,
          event_notes: event.event_notes,
          payment_status: event.payment_status,
          payment_amount: event.payment_amount,
          start_date: event.start_date,
          end_date: event.end_date,
          created_at: event.created_at,
          user_id: event.user_id,
          source: 'event',
          create_event: true,
          sort_date: event.created_at,
          // Map event_files to customer_files_new for UI compatibility
          customer_files_new: event.event_files || []
        };

        allData.push(eventItem);
      });

      // Add transformed booking requests with their files
      transformedBookingRequests.forEach(booking => {
        allData.push({
          ...booking,
          sort_date: booking.sort_date || booking.created_at
        });
      });

      // Add additional persons from events (but get their files from the parent event if applicable)
      (eventLinkedCustomers || []).forEach(customer => {
        allData.push({
          ...customer,
          source: 'additional',
          create_event: true,
          sort_date: customer.created_at
        });
      });

      // Remove duplicates using a Map based on unique identifiers
      const uniqueData = new Map();
      
      allData.forEach(item => {
        let key;
        if (item.source === 'event') {
          key = `event-${item.id.replace('event-', '')}`;
        } else if (item.source === 'booking_request') {
          key = `booking-${item.id.replace('booking-', '')}`;
        } else {
          key = `customer-${item.id}`;
        }
        
        // Keep the most recent version if duplicate found
        if (!uniqueData.has(key) || new Date(item.sort_date) > new Date(uniqueData.get(key).sort_date)) {
          uniqueData.set(key, item);
        }
      });

      // Convert back to array and sort by creation date (newest first)
      const result = Array.from(uniqueData.values()).sort((a, b) => {
        const dateA = new Date(a.sort_date || a.created_at || 0);
        const dateB = new Date(b.sort_date || b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });

      console.log('CRM data result with files:', {
        standaloneCustomers: standaloneCustomers?.length || 0,
        events: events?.length || 0,
        bookingRequests: bookingRequests?.length || 0,
        eventLinkedCustomers: eventLinkedCustomers?.length || 0,
        totalUniqueCustomers: result.length,
        dateRange: `${startDateStr} to ${endDateStr}`,
        filesFound: result.filter(item => item.customer_files_new && item.customer_files_new.length > 0).length
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return { combinedData, isLoading };
};
