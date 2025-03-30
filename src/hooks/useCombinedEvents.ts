
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useEffect, useState } from "react";

/**
 * Hook that fetches and combines both direct events and approved event requests
 * to ensure internal and external calendars are synchronized
 */
export const useCombinedEvents = (businessId?: string) => {
  const [combinedEvents, setCombinedEvents] = useState<CalendarEventType[]>([]);
  const queryClient = useQueryClient();

  // Fetch direct events from the events table
  const { data: directEvents, isLoading: isLoadingDirect, error: directError } = useQuery({
    queryKey: ['direct-business-events', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      console.log("[useCombinedEvents] Fetching direct events for business:", businessId);
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('business_id', businessId)
        .order('start_date', { ascending: true });
        
      if (error) {
        console.error("[useCombinedEvents] Error fetching direct events:", error);
        throw error;
      }
      
      console.log(`[useCombinedEvents] Retrieved ${data?.length || 0} direct events`);
      return data || [];
    },
    enabled: !!businessId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 5 * 1000, // 5 seconds
  });

  // Fetch approved event requests
  const { data: approvedRequests, isLoading: isLoadingRequests, error: requestsError } = useQuery({
    queryKey: ['approved-event-requests', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      console.log("[useCombinedEvents] Fetching approved requests for business:", businessId);
      
      const { data, error } = await supabase
        .from('event_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .order('start_date', { ascending: true });
        
      if (error) {
        console.error("[useCombinedEvents] Error fetching approved requests:", error);
        throw error;
      }
      
      console.log(`[useCombinedEvents] Retrieved ${data?.length || 0} approved requests`);
      return data || [];
    },
    enabled: !!businessId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 5 * 1000, // 5 seconds
  });

  // Force refetch to ensure we have the latest data
  useEffect(() => {
    if (businessId) {
      // Invalidate queries to force refresh
      queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-event-requests', businessId] });
    }
  }, [businessId, queryClient]);

  // Combine both data sources whenever either one changes
  useEffect(() => {
    if (!businessId) return;
    
    // Format approved requests to match the CalendarEventType
    const requestEvents: CalendarEventType[] = (approvedRequests || []).map(req => ({
      id: req.id,
      title: req.title,
      start_date: req.start_date,
      end_date: req.end_date,
      created_at: req.created_at,
      updated_at: req.updated_at || req.created_at,
      user_surname: req.user_surname,
      user_number: req.user_number,
      social_network_link: req.social_network_link,
      event_notes: req.event_notes,
      type: req.type || 'standard',
      payment_status: req.payment_status,
      payment_amount: req.payment_amount,
      business_id: req.business_id
    }));
    
    // Combine both arrays
    const allEvents: CalendarEventType[] = [
      ...(directEvents || []),
      ...requestEvents
    ];
    
    console.log(`[useCombinedEvents] Combined ${directEvents?.length || 0} direct events and ${approvedRequests?.length || 0} approved requests`);
    console.log(`[useCombinedEvents] Total events: ${allEvents.length}`);
    
    // Log event dates to help debug
    if (allEvents.length > 0) {
      console.log("[useCombinedEvents] Event dates:", 
        allEvents.slice(0, 3).map(e => ({ 
          id: e.id, 
          start: e.start_date, 
          title: e.title
        }))
      );
    }
    
    setCombinedEvents(allEvents);
  }, [directEvents, approvedRequests, businessId]);

  return {
    events: combinedEvents,
    isLoading: isLoadingDirect || isLoadingRequests,
    error: directError || requestsError,
    refetch: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
        queryClient.invalidateQueries({ queryKey: ['approved-event-requests', businessId] });
      }
    }
  };
};
