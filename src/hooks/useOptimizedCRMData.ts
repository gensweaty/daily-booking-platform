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
          id,
          title,
          user_surname,
          user_number,
          social_network_link,
          start_date,
          end_date,
          payment_status,
          payment_amount,
          create_event,
          created_at,
          type,
          customer_files_new!inner(count)
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
          id,
          booking_request_id,
          title,
          start_date,
          end_date,
          payment_status,
          payment_amount,
          created_at,
          event_files!inner(count)
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

      // Get event customers (customers created from approved bookings)
      const { data: eventLinkedCustomers, error: eventCustomersError } = await supabase
        .from('customers')
        .select(`
          id,
          title,
          user_surname,
          user_number,
          social_network_link,
          start_date,
          end_date,
          payment_status,
          payment_amount,
          create_event,
          created_at,
          type,
          customer_files_new!inner(count)
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

      // Helper function to fetch and process customer data
      const fetchOptimizedCustomers = async (customersData: any[]) => {
        let processedCustomers = customersData || [];
        
        // Map file counts and initialize file list for each customer
        processedCustomers = processedCustomers.map(cust => {
          const filesCount = cust.customer_files_new;
          cust.file_count = filesCount?.count ?? (Array.isArray(filesCount) ? filesCount[0]?.count : 0);
          cust.customer_files_new = [];  // prepare to fill with actual files
          return cust;
        });

        // After processing customers, but before returning:
        const bookingRequestCustomers = processedCustomers.filter(
          c => c.type === 'booking_request' || c.create_event
        );

        if (bookingRequestCustomers.length > 0) {
          const ids = bookingRequestCustomers.map(c => c.id);
          const { data: files, error } = await supabase
            .from('event_files')
            .select('*')
            .in('event_id', ids);

          if (!error && files) {
            for (const cust of bookingRequestCustomers) {
              cust.customer_files_new = files.filter(f => f.event_id === cust.id);
            }
          }
        }
        
        return processedCustomers;
      };

      // Helper function to fetch and process event data
      const fetchOptimizedEvents = async (eventsData: any[]) => {
        let processedEvents = eventsData || [];
        
        // Map file counts and initialize file list for each event
        processedEvents = processedEvents.map(evt => {
          const filesCount = evt.event_files;
          evt.file_count = filesCount?.count ?? (Array.isArray(filesCount) ? filesCount[0]?.count : 0);
          evt.event_files = [];  // will fill if attachments exist
          return evt;
        });

        // Fetch files for events that have attachments
        const eventsWithFiles = processedEvents.filter(e => (e.file_count ?? 0) > 0).map(e => e.id);
        if (eventsWithFiles.length) {
          const { data: fileRecords, error: filesErr } = await supabase
            .from('event_files')
            .select('*')
            .in('event_id', eventsWithFiles);
          
          if (!filesErr && fileRecords) {
            const filesByEvent = new Map<string, any[]>();
            for (const file of fileRecords) {
              if (!file.event_id) continue;
              if (!filesByEvent.has(file.event_id)) filesByEvent.set(file.event_id, []);
              const list = filesByEvent.get(file.event_id)!;
              if (!list.find(f => f.file_path === file.file_path)) {
                list.push(file);
              }
            }
            processedEvents = processedEvents.map(evt => ({
              ...evt,
              event_files: filesByEvent.get(evt.id) ?? []
            }));
          }
        }
        
        return processedEvents;
      };

      // Process customers and events
      const processedCustomers = await fetchOptimizedCustomers([...(standaloneCustomers || []), ...(eventLinkedCustomers || [])]);
      const processedEvents = await fetchOptimizedEvents(events || []);

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
      const combined: any[] = [];
      const seenSignatures = new Set();
      const customerIdSet = new Set(processedCustomers.map(c => c.id));

      // Add customers first
      for (const customer of processedCustomers) {
        if (!customer) continue;
        
        const signature = `${customer.title}:::${customer.start_date}:::${customer.user_number}`;
        
        if (!seenSignatures.has(signature)) {
          combined.push({
            ...customer,
            create_event: customer.create_event ?? false
          });
          seenSignatures.add(signature);
        }
      }

      // Add non-duplicate events
      for (const event of processedEvents) {
        if (!event) continue;
        
        // Skip event if its booking_request corresponds to an existing customer
        if (event.booking_request_id && customerIdSet.has(event.booking_request_id)) continue;
        
        const signature = `${event.title}:::${event.start_date}`;
        
        if (!seenSignatures.has(signature)) {
          combined.push({
            ...event,
            id: `event-${event.id}`,
            customer_files_new: event.event_files ?? [],
            create_event: false
          });
          seenSignatures.add(signature);
        }
      }

      // Add transformed booking requests
      transformedBookingRequests.forEach(booking => {
        combined.push({
          ...booking,
          sort_date: booking.sort_date || booking.created_at
        });
      });

      // Remove duplicates using a Map based on unique identifiers
      const uniqueData = new Map();
      
      combined.forEach(item => {
        let key;
        if (item.source === 'booking_request') {
          key = `booking-${item.id.replace('booking-', '')}`;
        } else if (item.id && item.id.toString().startsWith('event-')) {
          key = item.id;
        } else {
          key = `customer-${item.id}`;
        }
        
        // Keep the most recent version if duplicate found
        if (!uniqueData.has(key) || new Date(item.sort_date || item.created_at) > new Date(uniqueData.get(key).sort_date || uniqueData.get(key).created_at)) {
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
