
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { endOfDay } from 'date-fns';
import type { FileRecord } from '@/types/files';

export function useCRMData(userId: string | undefined, dateRange: { start: Date, end: Date }) {
  // Memoize query keys to prevent unnecessary re-renders
  const customersQueryKey = useMemo(() => 
    ['customers', dateRange.start.toISOString(), dateRange.end.toISOString(), userId],
    [dateRange.start, dateRange.end, userId]
  );

  const eventsQueryKey = useMemo(() => 
    ['events', dateRange.start.toISOString(), dateRange.end.toISOString(), userId],
    [dateRange.start, dateRange.end, userId]
  );

  // Fetch customers with optimized query
  const fetchCustomers = useCallback(async () => {
    if (!userId) return [];
    
    console.log("Fetching customers for user:", userId);
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        customer_files_new(*)
      `)
      .eq('user_id', userId)
      .or(`start_date.gte.${dateRange.start.toISOString()},created_at.gte.${dateRange.start.toISOString()}`)
      .or(`start_date.lte.${endOfDay(dateRange.end).toISOString()},created_at.lte.${endOfDay(dateRange.end).toISOString()}`)
      .is('deleted_at', null);

    if (error) {
      console.error("Error fetching customers:", error);
      throw error;
    }
    console.log("Retrieved customers:", data?.length || 0);
    return data || [];
  }, [userId, dateRange.start, dateRange.end]);

  // Fetch events with optimized query
  const fetchEvents = useCallback(async () => {
    if (!userId) return [];
    
    console.log("Fetching events for user:", userId);
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_date', dateRange.start.toISOString())
      .lte('start_date', endOfDay(dateRange.end).toISOString())
      .is('deleted_at', null);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw eventsError;
    }

    // Fetch files for each event, including those that came from booking requests
    const eventsWithFiles = await Promise.all(events.map(async (event) => {
      // First try getting files directly associated with the event
      const { data: eventFiles } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', event.id);
        
      // If this event was created from a booking request, also get those files
      let bookingFiles: any[] = [];
      if (event.booking_request_id) {
        const { data: bookingRequestFiles } = await supabase
          .from('event_files')
          .select('*')
          .eq('event_id', event.booking_request_id);
          
        if (bookingRequestFiles && bookingRequestFiles.length > 0) {
          bookingFiles = bookingRequestFiles;
          console.log(`Found ${bookingRequestFiles.length} files from original booking request`);
        }
      }
      
      // Also try getting any related files
      const { data: relatedFiles } = await supabase
        .rpc('get_all_related_files', {
          event_id_param: event.id,
          customer_id_param: null,
          entity_name_param: event.title
        });
      
      // Combine all files, removing duplicates by file_path
      const allFiles = [...(eventFiles || []), ...(bookingFiles || []), ...(relatedFiles || [])];
      const uniqueFilePaths = new Set();
      const uniqueFiles = allFiles.filter(file => {
        if (uniqueFilePaths.has(file.file_path)) return false;
        uniqueFilePaths.add(file.file_path);
        return true;
      });
      
      return {
        ...event,
        event_files: uniqueFiles || []
      };
    }));

    console.log("Retrieved events:", eventsWithFiles.length);
    return eventsWithFiles;
  }, [userId, dateRange.start, dateRange.end]);

  const { 
    data: customers = [], 
    isLoading: isLoadingCustomers,
    isFetching: isFetchingCustomers
  } = useQuery({
    queryKey: customersQueryKey,
    queryFn: fetchCustomers,
    enabled: !!userId,
    staleTime: 60000, // Cache results for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const { 
    data: events = [], 
    isLoading: isLoadingEvents,
    isFetching: isFetchingEvents
  } = useQuery({
    queryKey: eventsQueryKey,
    queryFn: fetchEvents,
    enabled: !!userId,
    staleTime: 60000, // Cache results for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Pre-process combined data to avoid doing it on every render
  const combinedData = useMemo(() => {
    // Return empty array quickly if still loading initial data
    if (isLoadingCustomers || isLoadingEvents) return [];
    
    console.log("Processing combined data from", customers.length, "customers and", events.length, "events");
    
    const combined = [];
    const existingIds = new Set(customers.map(c => 
      `${c.title}-${c.start_date}-${c.end_date}`
    ));

    // Add customers with default create_event property if missing
    for (const customer of customers) {
      combined.push({
        ...customer,
        create_event: customer.create_event !== undefined ? customer.create_event : false
      });
    }

    events.forEach(event => {
      const eventKey = `${event.title}-${event.start_date}-${event.end_date}`;
      
      if (!existingIds.has(eventKey)) {
        combined.push({
          ...event,
          id: `event-${event.id}`,
          customer_files_new: event.event_files,
          create_event: false // Add default create_event property
        });
      }
    });
    
    return combined;
  }, [customers, events, isLoadingCustomers, isLoadingEvents]);

  return {
    combinedData,
    isLoading: isLoadingCustomers || isLoadingEvents,
    isFetching: isFetchingCustomers || isFetchingEvents,
    customers,
    events
  };
}
