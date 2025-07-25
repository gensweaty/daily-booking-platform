
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

      // Get standalone customers (not linked to events) - filter by start_date if available, otherwise created_at
      const { data: standaloneCustomers, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .is('event_id', null)
        .or(`start_date.gte.${startDateStr},and(start_date.is.null,created_at.gte.${startDateStr})`)
        .or(`start_date.lte.${endDateStr},and(start_date.is.null,created_at.lte.${endDateStr})`)
        .is('deleted_at', null);

      if (customersError) {
        console.error('Error fetching standalone customers:', customersError);
      }

      // Get events in date range (only parent events to avoid duplicates)
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null)
        .is('parent_event_id', null); // Only parent events

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
        .is('deleted_at', null);

      if (bookingRequestsError) {
        console.error('Error fetching booking requests:', bookingRequestsError);
      }

      // Get additional persons linked to parent events in date range
      const parentEventIds = events?.map(event => event.id) || [];
      let eventLinkedCustomers: any[] = [];

      if (parentEventIds.length > 0) {
        const { data: customers, error: eventCustomersError } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', userId)
          .in('event_id', parentEventIds)
          .eq('type', 'customer')
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null);

        if (!eventCustomersError && customers) {
          eventLinkedCustomers = customers;
        }
      }

      // Transform booking requests to match customer structure
      const transformedBookingRequests = (bookingRequests || []).map(booking => ({
        ...booking,
        id: `booking-${booking.id}`,
        title: booking.title,
        user_surname: booking.requester_name,
        user_number: booking.requester_phone,
        social_network_link: booking.requester_email,
        event_notes: booking.description,
        source: 'booking_request',
        create_event: true
      }));

      // Combine all unique customers
      const uniqueCustomers = new Map<string, any>();

      // Add standalone customers
      (standaloneCustomers || []).forEach(customer => {
        const key = `standalone-${customer.id}`;
        uniqueCustomers.set(key, {
          ...customer,
          source: 'standalone',
          create_event: customer.create_event || false
        });
      });

      // Add main persons from events as customers
      (events || []).forEach(event => {
        const key = `event-${event.id}`;
        uniqueCustomers.set(key, {
          id: event.id,
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
          create_event: true
        });
      });

      // Add transformed booking requests
      transformedBookingRequests.forEach(booking => {
        const key = `booking-${booking.id}`;
        uniqueCustomers.set(key, booking);
      });

      // Add additional persons from events
      eventLinkedCustomers.forEach(customer => {
        const key = `additional-${customer.id}`;
        uniqueCustomers.set(key, {
          ...customer,
          source: 'additional',
          create_event: true
        });
      });

      const result = Array.from(uniqueCustomers.values());

      console.log('CRM data result:', {
        standaloneCustomers: standaloneCustomers?.length || 0,
        events: events?.length || 0,
        bookingRequests: bookingRequests?.length || 0,
        eventLinkedCustomers: eventLinkedCustomers.length,
        totalUniqueCustomers: result.length,
        dateRange: `${startDateStr} to ${endDateStr}`
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return { combinedData, isLoading };
};
