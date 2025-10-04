
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { endOfDay } from 'date-fns';
import type { FileRecord } from '@/types/files';

// This interface defines the shape of event objects in our application
interface EventWithCustomerId {
  id: string;
  customer_id?: string;
  parent_event_id?: string; // Add parent_event_id to handle recurring events
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

  // Fetch customers with optimized query and proper date filtering - ORDER BY created_at DESC
  const fetchCustomers = useCallback(async () => {
    if (!userId) return [];
    
    console.log("Fetching customers for user:", userId, "with date range:", {
      start: dateRange.start.toISOString(),
      end: endOfDay(dateRange.end).toISOString()
    });
    
    // Filter customers by their creation date (when they were added to the system)
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        customer_files_new(*)
      `)
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', endOfDay(dateRange.end).toISOString())
      .is('deleted_at', null)
      .order('created_at', { ascending: false }); // Sort by created_at in descending order (newest first)

    if (error) {
      console.error("Error fetching customers:", error);
      throw error;
    }
    console.log("Retrieved customers in date range:", data?.length || 0);
    return data || [];
  }, [userId, dateRange.start, dateRange.end]);

  // Fetch events with optimized query - ONLY fetch parent events to avoid duplicates, ORDER BY created_at DESC
  const fetchEvents = useCallback(async () => {
    if (!userId) return [];
    
    console.log("Fetching events for user:", userId);
    // Filter events by their creation date (when they were added to the system)
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', endOfDay(dateRange.end).toISOString())
      .is('deleted_at', null)
      .is('parent_event_id', null) // ONLY fetch parent events, not child instances
      .order('created_at', { ascending: false }); // Sort by created_at in descending order (newest first)

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw eventsError;
    }

    // Fetch files for each event with improved typing
    const eventsWithFiles = await Promise.all((events as EventWithCustomerId[]).map(async (event) => {
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

    console.log("Retrieved parent events:", eventsWithFiles.length);
    return eventsWithFiles;
  }, [userId, dateRange.start, dateRange.end]);

  const { 
    data: customers = [], 
    isLoading: isLoadingCustomers,
    isFetching: isFetchingCustomers
  } = useQuery({
    queryKey: ['customers', dateRange.start.toISOString(), dateRange.end.toISOString(), userId],
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
    queryKey: ['events', dateRange.start.toISOString(), dateRange.end.toISOString(), userId],
    queryFn: fetchEvents,
    enabled: !!userId,
    staleTime: 60000, // Cache results for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Pre-process combined data with improved deduplication and proper sorting
  const combinedData = useMemo(() => {
    // Return empty array quickly if still loading initial data
    if (isLoadingCustomers || isLoadingEvents) return [];
    
    console.log("Processing combined data from", customers.length, "customers and", events.length, "parent events");
    
    const combined = [];
    
    // Map to track which customers are included by ID
    const customerIdMap = new Map();
    
    // Map unique identifiers to detect duplicates more reliably
    // Format: title:phoneNumber:emailOrSocial:startDate
    const itemSignatureMap = new Map();
    
    // Generate a unique signature for deduplication
    const generateItemSignature = (item: any) => {
      const title = item.title || item.user_surname || '';
      const phone = item.user_number || item.requester_phone || '';
      const email = item.social_network_link || item.requester_email || '';
      const startDate = item.start_date || '';
      
      return `${title}:${phone}:${email}:${startDate}`;
    };
    
    // Add all customers to the combined array first
    for (const customer of customers) {
      if (!customer) continue;
      
      const signature = generateItemSignature(customer);
      
      // Skip if we've already added this signature
      if (itemSignatureMap.has(signature)) {
        console.log(`Skipping duplicate customer: ${customer.title} - Signature: ${signature}`);
        continue;
      }
      
      // Add customer to results and track its signature and ID
      combined.push({
        ...customer,
        create_event: customer.create_event !== undefined ? customer.create_event : false
      });
      
      customerIdMap.set(customer.id, true);
      itemSignatureMap.set(signature, true);
    }

    // Process events - only add those that aren't represented by customers
    // Since we only fetch parent events now, we don't need to worry about child instances
    for (const event of (events as EventWithCustomerId[])) {
      if (!event) continue;
      
      // Skip events that have a customer_id that matches one we've already included
      if (event.customer_id && customerIdMap.has(event.customer_id)) {
        console.log(`Skipping event ${event.id} because it's associated with customer ${event.customer_id}`);
        continue;
      }
      
      const signature = generateItemSignature(event);
      
      // Skip if we've already added an item with the same signature
      if (itemSignatureMap.has(signature)) {
        console.log(`Skipping duplicate event: ${event.title} - Signature: ${signature}`);
        continue;
      }
      
      // Add the event to our results with proper formatting
      combined.push({
        ...event,
        id: `event-${event.id}`,
        customer_files_new: event.event_files, // Map event_files to customer_files_new for UI compatibility
        create_event: false // Default value
      });
      
      // Track this signature to avoid duplicates
      itemSignatureMap.set(signature, true);
    }
    
    // Sort by created_at in descending order (newest first)
    combined.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // DESC order (newest first)
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
