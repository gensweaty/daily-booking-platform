
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

    console.log(`Found ${events.length} events, now fetching their files...`);

    // Fetch files for each event using multiple approaches for redundancy
    const eventsWithFiles = await Promise.all(events.map(async (event) => {
      console.log(`Fetching files for event ID: ${event.id}`);
      const allFiles: any[] = [];
      const filePathsAdded = new Set<string>();
      
      // Strategy 1: Get files directly associated with the event from event_files table
      const { data: eventFiles } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', event.id);
        
      if (eventFiles && eventFiles.length > 0) {
        console.log(`Found ${eventFiles.length} files in event_files table`);
        eventFiles.forEach(file => {
          if (file.file_path && !filePathsAdded.has(file.file_path)) {
            allFiles.push({
              ...file,
              source: 'event_files'
            });
            filePathsAdded.add(file.file_path);
          }
        });
      }
      
      // Strategy 2: If the event was created from a booking request, get those files
      if (event.booking_request_id) {
        console.log(`Event has booking_request_id: ${event.booking_request_id}, looking for related files...`);
        
        // Try the RPC function first
        try {
          const { data: bookingFiles } = await supabase
            .rpc('get_booking_request_files', { booking_id_param: event.booking_request_id });
            
          if (bookingFiles && bookingFiles.length > 0) {
            console.log(`Found ${bookingFiles.length} files from booking request via RPC`);
            bookingFiles.forEach(file => {
              if (file.file_path && !filePathsAdded.has(file.file_path)) {
                allFiles.push({
                  ...file,
                  source: 'booking_request_rpc'
                });
                filePathsAdded.add(file.file_path);
              }
            });
          }
        } catch (rpcError) {
          console.error("Error using get_booking_request_files RPC:", rpcError);
        }
        
        // Check booking_request directly as backup
        const { data: bookingData } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('id', event.booking_request_id)
          .maybeSingle();
          
        // Safely access potential file data with explicit type checking
        if (bookingData && typeof bookingData === 'object') {
          // Check if file_path exists and is a string
          const filePath = 'file_path' in bookingData && typeof bookingData.file_path === 'string' 
            ? bookingData.file_path 
            : null;
            
          if (filePath && !filePathsAdded.has(filePath)) {
            console.log("Found file metadata in booking_requests table");
            allFiles.push({
              id: `fallback_${bookingData.id}`,
              filename: 'filename' in bookingData && typeof bookingData.filename === 'string' 
                      ? bookingData.filename 
                      : 'attachment',
              file_path: filePath,
              content_type: 'content_type' in bookingData && typeof bookingData.content_type === 'string' 
                          ? bookingData.content_type 
                          : 'application/octet-stream',
              size: 'file_size' in bookingData && typeof bookingData.file_size === 'number' 
                  ? bookingData.file_size 
                  : ('size' in bookingData && typeof bookingData.size === 'number' 
                    ? bookingData.size 
                    : 0),
              created_at: bookingData.created_at,
              source: 'booking_requests'
            });
            filePathsAdded.add(filePath);
          }
        }
      }
      
      // Strategy 3: Check if the event itself has file metadata 
      if (event.file_path && typeof event.file_path === 'string' && !filePathsAdded.has(event.file_path)) {
        console.log("Event itself has file metadata");
        allFiles.push({
          id: `event_metadata_${event.id}`,
          filename: event.filename || 'attachment',
          file_path: event.file_path,
          content_type: event.content_type || 'application/octet-stream',
          size: event.file_size || event.size || 0,
          created_at: event.created_at,
          source: 'event_metadata'
        });
        filePathsAdded.add(event.file_path);
      }
      
      // Strategy 4: Try getting related files
      try {
        const { data: relatedFiles } = await supabase
          .rpc('get_all_related_files', {
            event_id_param: event.id,
            customer_id_param: null,
            entity_name_param: event.title
          });
        
        if (relatedFiles && relatedFiles.length > 0) {
          console.log(`Found ${relatedFiles.length} related files`);
          relatedFiles.forEach(file => {
            if (file.file_path && !filePathsAdded.has(file.file_path)) {
              allFiles.push({
                ...file,
                source: 'related_files'
              });
              filePathsAdded.add(file.file_path);
            }
          });
        }
      } catch (error) {
        console.error("Error getting related files:", error);
      }

      console.log(`Total files found for event ${event.id}: ${allFiles.length}`);
      
      return {
        ...event,
        event_files: allFiles
      };
    }));

    console.log("Retrieved events with files:", eventsWithFiles.length);
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
