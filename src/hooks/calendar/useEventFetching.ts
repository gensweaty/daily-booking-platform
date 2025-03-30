
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";

export const useEventFetching = () => {
  const { user } = useAuth();

  const getEvents = async () => {
    try {
      let query = supabase.from('events').select('*').order('start_date', { ascending: true });
      
      // If user is authenticated, filter events by user_id
      if (user) {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query;

      if (error) {
        console.error("Error fetching events:", error);
        throw error;
      }
      
      console.log(`Retrieved ${data?.length || 0} events for user:`, user?.id);
      return data;
    } catch (err) {
      console.error("Failed to fetch events:", err);
      throw err;
    }
  };

  const getPublicEvents = async (businessId: string) => {
    if (!businessId) {
      console.warn("No business ID provided for public events");
      return [];
    }
    
    console.log("[useEventFetching] Fetching public events for business ID:", businessId);
    
    try {
      // 1. Get direct events (added internally)
      const { data: directEvents, error: directEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('business_id', businessId)
        .order('start_date', { ascending: true });
      
      if (directEventsError) {
        console.error("[useEventFetching] Error fetching business direct events:", directEventsError);
        throw directEventsError;
      }
      
      console.log(`[useEventFetching] Retrieved ${directEvents?.length || 0} direct events for business ID:`, businessId);
      
      // 2. Get approved event requests
      const { data: approvedRequests, error: requestsError } = await supabase
        .from('event_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .order('start_date', { ascending: true });
      
      if (requestsError) {
        console.error("[useEventFetching] Error fetching approved event requests:", requestsError);
        throw requestsError;
      }
      
      console.log(`[useEventFetching] Retrieved ${approvedRequests?.length || 0} approved request events for business ID:`, businessId);
      
      // Convert approved requests to event format
      const requestEvents = (approvedRequests || []).map(req => ({
        id: req.id,
        title: req.title,
        start_date: req.start_date,
        end_date: req.end_date,
        created_at: req.created_at,
        updated_at: req.updated_at,
        user_surname: req.user_surname,
        user_number: req.user_number,
        social_network_link: req.social_network_link,
        event_notes: req.event_notes,
        type: req.type,
        payment_status: req.payment_status,
        payment_amount: req.payment_amount,
        business_id: req.business_id
      }));
      
      // Combine both arrays for public display
      const combinedEvents = [...(directEvents || []), ...requestEvents];
      
      console.log(`[useEventFetching] Total public events: ${combinedEvents.length} (${directEvents?.length || 0} direct + ${approvedRequests?.length || 0} requests)`);
      
      if (combinedEvents.length > 0) {
        console.log("[useEventFetching] Sample event data:", {
          id: combinedEvents[0].id,
          title: combinedEvents[0].title,
          start: combinedEvents[0].start_date,
          type: combinedEvents[0].type || 'standard'
        });
      }
      
      return combinedEvents;
    } catch (err) {
      console.error("[useEventFetching] Failed to fetch public events:", err);
      throw err;
    }
  };

  const getAllBusinessEvents = async (businessId: string) => {
    if (!businessId) {
      console.warn("No business ID provided for getting all business events");
      return [];
    }
    
    console.log("[useEventFetching] Fetching ALL events for business ID:", businessId);
    
    try {
      // Get direct events from the events table
      const { data: directEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('business_id', businessId)
        .order('start_date', { ascending: true });

      if (eventsError) {
        console.error("[useEventFetching] Error fetching all business events:", eventsError);
        throw eventsError;
      }
      
      console.log(`[useEventFetching] Retrieved ${directEvents?.length || 0} direct events for business:`, businessId);
      
      // Get approved event requests
      const { data: approvedRequests, error: requestsError } = await supabase
        .from('event_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .order('start_date', { ascending: true });
        
      if (requestsError) {
        console.error("[useEventFetching] Error fetching approved requests:", requestsError);
        throw requestsError;
      }
      
      console.log(`[useEventFetching] Retrieved ${approvedRequests?.length || 0} approved request events for business:`, businessId);
      
      // Convert approved requests to event format
      const requestEvents = (approvedRequests || []).map(req => ({
        id: req.id,
        title: req.title,
        start_date: req.start_date,
        end_date: req.end_date,
        created_at: req.created_at,
        updated_at: req.updated_at,
        user_surname: req.user_surname,
        user_number: req.user_number,
        social_network_link: req.social_network_link,
        event_notes: req.event_notes,
        type: req.type,
        payment_status: req.payment_status,
        payment_amount: req.payment_amount,
        business_id: req.business_id
      }));
      
      // Combine direct events and approved requests
      const allEvents = [...(directEvents || []), ...requestEvents];
      
      console.log(`[useEventFetching] Retrieved ${allEvents.length} total events (${directEvents?.length || 0} direct, ${approvedRequests?.length || 0} requests) for business:`, businessId);
      
      if (allEvents.length > 0) {
        console.log("[useEventFetching] Sample event data:", {
          id: allEvents[0].id,
          title: allEvents[0].title,
          start: allEvents[0].start_date,
          type: allEvents[0].type || 'standard'
        });
      }
      
      return allEvents;
    } catch (err) {
      console.error("[useEventFetching] Failed to fetch all business events:", err);
      throw err;
    }
  };

  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: !!user, 
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
  });

  return {
    events,
    isLoading,
    error,
    refetch,
    getEvents,
    getPublicEvents,
    getAllBusinessEvents,
  };
};
