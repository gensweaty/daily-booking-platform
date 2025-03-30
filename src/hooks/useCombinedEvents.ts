
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useEffect, useState } from "react";
import { getAllBusinessEvents } from "@/lib/api";

/**
 * Hook that fetches and combines both direct events and event requests
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
      
      try {
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
      } catch (err) {
        console.error("[useCombinedEvents] Error in fetchDirectEvents:", err);
        return [];
      }
    },
    enabled: !!businessId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 1000, // 1 second
  });

  // Fetch ALL event requests (not just approved ones)
  const { data: allRequests, isLoading: isLoadingRequests, error: requestsError } = useQuery({
    queryKey: ['all-event-requests', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      console.log("[useCombinedEvents] Fetching ALL requests for business:", businessId);
      
      try {
        const { data, error } = await supabase
          .from('event_requests')
          .select('*')
          .eq('business_id', businessId)
          .order('start_date', { ascending: true });
          
        if (error) {
          console.error("[useCombinedEvents] Error fetching all requests:", error);
          throw error;
        }
        
        console.log(`[useCombinedEvents] Retrieved ${data?.length || 0} total requests`);
        return data || [];
      } catch (err) {
        console.error("[useCombinedEvents] Error in fetchAllRequests:", err);
        return [];
      }
    },
    enabled: !!businessId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 1000, // 1 second
  });
  
  // Fetch combined events directly from API as a backup
  const { data: apiEvents, isLoading: isLoadingApi, refetch: refetchApi } = useQuery({
    queryKey: ['api-combined-events', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      console.log("[useCombinedEvents] Fetching all events from API for business:", businessId);
      
      try {
        const events = await getAllBusinessEvents(businessId);
        console.log(`[useCombinedEvents] API fetch retrieved ${events?.length || 0} total events`);
        return events || [];
      } catch (err) {
        console.error("[useCombinedEvents] Error in API fetch:", err);
        return [];
      }
    },
    enabled: !!businessId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 1000, // 1 second
  });

  // Force refetch to ensure we have the latest data
  useEffect(() => {
    if (businessId) {
      // Invalidate queries to force refresh
      queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['all-event-requests', businessId] });
      queryClient.invalidateQueries({ queryKey: ['api-combined-events', businessId] });
      
      // Schedule additional refetch after a short delay to catch any new updates
      const timer = setTimeout(() => {
        if (businessId) {
          queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
          queryClient.invalidateQueries({ queryKey: ['all-event-requests', businessId] });
          queryClient.invalidateQueries({ queryKey: ['api-combined-events', businessId] });
          refetchApi();
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [businessId, queryClient, refetchApi]);

  // Combine both data sources whenever either one changes
  useEffect(() => {
    if (!businessId) {
      setCombinedEvents([]);
      return;
    }
    
    let allEvents: CalendarEventType[] = [];
    
    // First try the separate queries (direct events + all requests)
    if (directEvents && allRequests) {
      // Format all requests to match the CalendarEventType
      const requestEvents: CalendarEventType[] = allRequests.map(req => ({
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
        business_id: req.business_id,
        status: req.status // Include status to differentiate in UI if needed
      }));
      
      // Combine both arrays
      allEvents = [
        ...(directEvents || []),
        ...requestEvents
      ];
      
      console.log(`[useCombinedEvents] Combined ${directEvents?.length || 0} direct events and ${allRequests?.length || 0} requests`);
    } 
    // Fallback to API directly fetched events if available and there was an issue with separate queries
    else if (apiEvents && apiEvents.length > 0) {
      allEvents = apiEvents;
      console.log(`[useCombinedEvents] Using API fetched events (${apiEvents.length}) as fallback`);
    }
    
    console.log(`[useCombinedEvents] Total events: ${allEvents.length}`);
    
    // Log event dates to help debug
    if (allEvents.length > 0) {
      console.log("[useCombinedEvents] Sample events:", 
        allEvents.slice(0, 3).map(e => ({ 
          id: e.id, 
          title: e.title,
          start: e.start_date,
          status: (e as any).status // Log status if available
        }))
      );
    }
    
    setCombinedEvents(allEvents);
  }, [directEvents, allRequests, apiEvents, businessId]);

  return {
    events: combinedEvents,
    isLoading: isLoadingDirect || isLoadingRequests || isLoadingApi,
    error: directError || requestsError,
    refetch: () => {
      console.log(`[useCombinedEvents] Manually triggering refetch for business: ${businessId}`);
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
        queryClient.invalidateQueries({ queryKey: ['all-event-requests', businessId] });
        queryClient.invalidateQueries({ queryKey: ['api-combined-events', businessId] });
        refetchApi();
      }
    }
  };
};
