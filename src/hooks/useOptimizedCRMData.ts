
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { endOfDay } from 'date-fns';

interface OptimizedCustomer {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  start_date?: string;
  end_date?: string;
  payment_status?: string;
  payment_amount?: number;
  create_event?: boolean;
  created_at: string;
  file_count?: number; // Just count instead of full file data
}

interface OptimizedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  payment_status?: string;
  payment_amount?: number;
  created_at: string;
  file_count?: number;
}

export function useOptimizedCRMData(userId: string | undefined, dateRange: { start: Date, end: Date }) {
  // Single query for customers with file counts
  const fetchOptimizedCustomers = useCallback(async () => {
    if (!userId) return [];
    
    // Use a more efficient query with counting
    const { data, error } = await supabase
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
        customer_files_new!inner(count)
      `)
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', endOfDay(dateRange.end).toISOString())
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching optimized customers:", error);
      throw error;
    }

    return data || [];
  }, [userId, dateRange.start, dateRange.end]);

  // Single query for events with file counts
  const fetchOptimizedEvents = useCallback(async () => {
    if (!userId) return [];
    
    const { data, error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        start_date,
        end_date,
        payment_status,
        payment_amount,
        created_at,
        event_files!inner(count)
      `)
      .eq('user_id', userId)
      .gte('start_date', dateRange.start.toISOString())
      .lte('start_date', endOfDay(dateRange.end).toISOString())
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching optimized events:", error);
      throw error;
    }

    return data || [];
  }, [userId, dateRange.start, dateRange.end]);

  const { 
    data: customers = [], 
    isLoading: isLoadingCustomers 
  } = useQuery({
    queryKey: ['optimized-customers', dateRange.start.toISOString(), dateRange.end.toISOString(), userId],
    queryFn: fetchOptimizedCustomers,
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
    refetchOnWindowFocus: false,
  });

  const { 
    data: events = [], 
    isLoading: isLoadingEvents 
  } = useQuery({
    queryKey: ['optimized-events-crm', dateRange.start.toISOString(), dateRange.end.toISOString(), userId],
    queryFn: fetchOptimizedEvents,
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Efficient deduplication using Map
  const combinedData = useMemo(() => {
    if (isLoadingCustomers || isLoadingEvents) return [];
    
    const combined = [];
    const seenSignatures = new Set();
    
    // Add customers first
    for (const customer of customers) {
      if (!customer) continue;
      
      const signature = `${customer.title}:${customer.user_number}:${customer.social_network_link}`;
      
      if (!seenSignatures.has(signature)) {
        combined.push({
          ...customer,
          customer_files_new: [], // Empty array instead of loading files
          create_event: customer.create_event !== undefined ? customer.create_event : false
        });
        seenSignatures.add(signature);
      }
    }

    // Add non-duplicate events
    for (const event of events) {
      if (!event) continue;
      
      const signature = `${event.title}:::${event.start_date}`;
      
      if (!seenSignatures.has(signature)) {
        combined.push({
          ...event,
          id: `event-${event.id}`,
          customer_files_new: [],
          create_event: false
        });
        seenSignatures.add(signature);
      }
    }
    
    return combined.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [customers, events, isLoadingCustomers, isLoadingEvents]);

  return {
    combinedData,
    isLoading: isLoadingCustomers || isLoadingEvents,
    customers,
    events
  };
}
