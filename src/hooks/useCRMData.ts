
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { endOfDay } from 'date-fns';
import type { FileRecord } from '@/types/files';

// This interface defines the shape of event objects in our application
interface EventWithCustomerId {
  id: string;
  customer_id?: string;
  [key: string]: any; // Allow other properties
}

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

  // Fetch customers with optimized query and proper date filtering
  const fetchCustomers = useCallback(async () => {
    if (!userId) return [];
    
    console.log("Fetching customers for user:", userId, "with date range:", {
      start: dateRange.start.toISOString(),
      end: endOfDay(dateRange.end).toISOString()
    });
    
    // Improved query: use explicit date range filters that match how we filter events
    // This ensures consistent filtering between customers and events
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        customer_files_new(*)
      `)
      .eq('user_id', userId)
      .or(
        `start_date.gte.${dateRange.start.toISOString()},created_at.gte.${dateRange.start.toISOString()}`
      )
      .or(
        `start_date.lte.${endOfDay(dateRange.end).toISOString()},created_at.lte.${endOfDay(dateRange.end).toISOString()}`
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false }); // Sort by created_at in descending order

    if (error) {
      console.error("Error fetching customers:", error);
      throw error;
    }
    console.log("Retrieved customers in date range:", data?.length || 0);
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
      .is('deleted_at', null)
      .order('created_at', { ascending: false }); // Sort by created_at in descending order

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw eventsError;
    }

    // Fetch files for each event - with safety check for undefined event IDs
    const eventsWithFiles = await Promise.all(events.map(async (event) => {
      if (!event.id) {
        console.error("Event without ID detected:", event);
        return { ...event, event_files: [] };
      }
      
      // Use direct query to event_files to ensure we only get files specifically linked to this event
      const { data: eventFiles, error: eventFilesError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', event.id);
        
      if (eventFilesError) {
        console.error("Error fetching event files:", eventFilesError);
        return { ...event, event_files: [] };
      }
      
      return {
        ...event,
        event_files: eventFiles || []
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
    
    // Create a map of customer IDs to track which customers are included
    const customerIdMap = new Map();
    
    // Add all customers to the combined array and to the ID map
    for (const customer of customers) {
      combined.push({
        ...customer,
        create_event: customer.create_event !== undefined ? customer.create_event : false
      });
      
      // Add customer ID to the map
      customerIdMap.set(customer.id, true);
    }

    // Only add events that aren't already represented by a customer (by ID or original ID)
    for (const event of events as EventWithCustomerId[]) {
      // Skip events that have an original customer ID that matches one of our customers
      // Safely check if the event has a customer_id property before trying to access it
      if (event.customer_id && customerIdMap.has(event.customer_id)) {
        continue;
      }
      
      combined.push({
        ...event,
        id: `event-${event.id}`,
        customer_files_new: event.event_files,
        create_event: false // Add default create_event property
      });
    }
    
    // Sort the combined data by created_at in descending order (newest first)
    combined.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
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
