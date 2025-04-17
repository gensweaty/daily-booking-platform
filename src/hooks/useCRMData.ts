
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { endOfDay } from 'date-fns';

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

    if (error) throw error;
    return data || [];
  }, [userId, dateRange.start, dateRange.end]);

  // Fetch events with optimized query
  const fetchEvents = useCallback(async () => {
    if (!userId) return [];
    
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_files(*)
      `)
      .eq('user_id', userId)
      .gte('start_date', dateRange.start.toISOString())
      .lte('start_date', endOfDay(dateRange.end).toISOString())
      .is('deleted_at', null);

    if (error) throw error;
    return data || [];
  }, [userId, dateRange.start, dateRange.end]);

  const { 
    data: customers = [], 
    isLoading: isLoadingCustomers 
  } = useQuery({
    queryKey: customersQueryKey,
    queryFn: fetchCustomers,
    enabled: !!userId,
    staleTime: 30000, // Cache results for 30 seconds
  });

  const { 
    data: events = [], 
    isLoading: isLoadingEvents 
  } = useQuery({
    queryKey: eventsQueryKey,
    queryFn: fetchEvents,
    enabled: !!userId,
    staleTime: 30000, // Cache results for 30 seconds
  });

  // Pre-process combined data to avoid doing it on every render
  const combinedData = useMemo(() => {
    if (isLoadingCustomers || isLoadingEvents) return [];
    
    const combined = [...customers];
    const existingIds = new Set(customers.map(c => 
      `${c.title}-${c.start_date}-${c.end_date}`
    ));

    events.forEach(event => {
      const eventKey = `${event.title}-${event.start_date}-${event.end_date}`;
      
      if (!existingIds.has(eventKey)) {
        combined.push({
          ...event,
          id: `event-${event.id}`,
          customer_files_new: event.event_files
        });
      }
    });
    
    return combined;
  }, [customers, events, isLoadingCustomers, isLoadingEvents]);

  return {
    combinedData,
    isLoading: isLoadingCustomers || isLoadingEvents,
    customers,
    events
  };
}
