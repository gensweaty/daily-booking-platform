
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";

export const useCalendarEvents = () => {
  const queryClient = useQueryClient();
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
    
    console.log("[useCalendarEvents] Fetching public events for business ID:", businessId);
    
    try {
      // Get all events for this business - both direct and from approved requests
      const eventsPromise = supabase
        .from('events')
        .select('*')
        .eq('business_id', businessId)
        .order('start_date', { ascending: true });
      
      const requestsPromise = supabase
        .from('event_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .order('start_date', { ascending: true });
      
      // Run both queries in parallel
      const [eventsResult, requestsResult] = await Promise.all([
        eventsPromise,
        requestsPromise
      ]);

      if (eventsResult.error) {
        console.error("[useCalendarEvents] Error fetching business events:", eventsResult.error);
        throw eventsResult.error;
      }

      if (requestsResult.error) {
        console.error("[useCalendarEvents] Error fetching approved event requests:", requestsResult.error);
        throw requestsResult.error;
      }
      
      const events = eventsResult.data || [];
      const approvedRequests = requestsResult.data || [];
      
      // Convert approved requests to event format
      const requestEvents = approvedRequests.map(req => ({
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
      
      // Combine both arrays
      const combinedEvents = [...events, ...requestEvents];
      
      console.log(`[useCalendarEvents] Retrieved ${events.length} direct events and ${approvedRequests.length} approved requests for business:`, businessId);
      
      return combinedEvents;
    } catch (err) {
      console.error("[useCalendarEvents] Failed to fetch public events:", err);
      throw err;
    }
  };

  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      if (!user) throw new Error("User must be authenticated to create events");
      
      // Create a clean copy of data to avoid modifying the original
      const eventData = { ...event };
      
      // Set user_id for the event
      eventData.user_id = user.id;
      
      console.log("[useCalendarEvents] Creating event with full data:", JSON.stringify(eventData));
      
      const { data, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (error) {
        console.error("[useCalendarEvents] Error creating event:", error);
        throw error;
      }
      
      console.log("[useCalendarEvents] Event created successfully:", data);
      
      // Immediately invalidate relevant queries to ensure sync
      if (eventData.business_id) {
        queryClient.invalidateQueries({ queryKey: ['public-events', eventData.business_id] });
      }
      
      return data;
    } catch (err) {
      console.error("[useCalendarEvents] Failed to create event:", err);
      throw err;
    }
  };

  const updateEvent = async (updates: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      if (!user) throw new Error("User must be authenticated to update events");
      
      // Get the ID from the updates object
      const id = updates.id;
      if (!id) throw new Error("Event ID is required for updates");
      
      // Create a clean copy of updates to avoid modifying the original
      const cleanUpdates = { ...updates };
      delete cleanUpdates.id; // Remove id from the updates
      
      console.log(`[useCalendarEvents] Updating event ${id} with full data:`, JSON.stringify(cleanUpdates));
      
      // First, fetch the current event to get its business_id (if any)
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('business_id')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        console.error("[useCalendarEvents] Error fetching current event:", fetchError);
      }
      
      const currentBusinessId = currentEvent?.business_id;
      console.log("[useCalendarEvents] Current business_id:", currentBusinessId);
      
      const { data, error } = await supabase
        .from('events')
        .update(cleanUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error("[useCalendarEvents] Error updating event:", error);
        throw error;
      }
      
      console.log("[useCalendarEvents] Event updated successfully:", data);
      
      // Invalidate queries for both the old and new business_id
      if (currentBusinessId) {
        queryClient.invalidateQueries({ queryKey: ['public-events', currentBusinessId] });
      }
      
      if (cleanUpdates.business_id && cleanUpdates.business_id !== currentBusinessId) {
        queryClient.invalidateQueries({ queryKey: ['public-events', cleanUpdates.business_id] });
      }
      
      return data;
    } catch (err) {
      console.error("[useCalendarEvents] Failed to update event:", err);
      throw err;
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    try {
      if (!user) throw new Error("User must be authenticated to delete events");
      
      // First, fetch the current event to get its business_id (if any)
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('business_id')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        console.error("[useCalendarEvents] Error fetching current event:", fetchError);
      }
      
      const currentBusinessId = currentEvent?.business_id;
      console.log(`[useCalendarEvents] Deleting event ${id} with business_id:`, currentBusinessId);
      
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error("[useCalendarEvents] Error deleting event:", error);
        throw error;
      }
      
      console.log("[useCalendarEvents] Event deleted successfully");
      
      // Invalidate public events query if the event had a business_id
      if (currentBusinessId) {
        queryClient.invalidateQueries({ queryKey: ['public-events', currentBusinessId] });
      }
    } catch (err) {
      console.error("[useCalendarEvents] Failed to delete event:", err);
      throw err;
    }
  };

  const createEventRequest = async (event: Partial<CalendarEventType>): Promise<any> => {
    // For public booking requests - no auth required
    try {
      // Make sure event has required fields
      if (!event.business_id) {
        throw new Error("Business ID is required for event requests");
      }

      console.log("[useCalendarEvents] Creating event request:", event);
      
      // Check for conflicts before creating the request
      const startDate = new Date(event.start_date as string);
      const endDate = new Date(event.end_date as string);
      
      // Check existing events and approved requests for conflicts
      const { available } = await checkTimeSlotAvailability(
        startDate,
        endDate,
        event.business_id
      );
      
      if (!available) {
        throw new Error("This time slot conflicts with an existing booking");
      }
      
      // No need to attach user_id for anonymous requests
      const { data, error } = await supabase
        .from('event_requests')
        .insert([{ 
          ...event,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        console.error("[useCalendarEvents] Error creating event request:", error);
        throw error;
      }
      
      console.log("[useCalendarEvents] Event request created successfully:", data);
      
      // Immediately invalidate relevant queries to ensure sync
      if (event.business_id) {
        queryClient.invalidateQueries({ queryKey: ['public-events', event.business_id] });
      }
      
      return data;
    } catch (error) {
      console.error("[useCalendarEvents] Error in createEventRequest:", error);
      throw error;
    }
  };
  
  // Helper function to check availability of a time slot
  const checkTimeSlotAvailability = async (
    startDate: Date,
    endDate: Date,
    businessId: string
  ): Promise<{ available: boolean; conflictingEvent?: any }> => {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    try {
      // Check existing events for conflicts
      const { data: existingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('business_id', businessId)
        .gte('start_date', startDate.toISOString().split('T')[0])
        .lte('start_date', endDate.toISOString().split('T')[0] + 'T23:59:59');
        
      if (eventsError) {
        console.error("[useCalendarEvents] Error checking for existing events:", eventsError);
        throw eventsError;
      }
      
      // Check approved requests for conflicts
      const { data: approvedRequests, error: requestsError } = await supabase
        .from('event_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .gte('start_date', startDate.toISOString().split('T')[0])
        .lte('start_date', endDate.toISOString().split('T')[0] + 'T23:59:59');
        
      if (requestsError) {
        console.error("[useCalendarEvents] Error checking for approved requests:", requestsError);
        throw requestsError;
      }
      
      // Check for conflicts
      const allEvents = [...(existingEvents || []), ...(approvedRequests || [])];
      
      const conflict = allEvents.find(e => {
        const eStart = new Date(e.start_date).getTime();
        const eEnd = new Date(e.end_date).getTime();
        return (startTime < eEnd && endTime > eStart);
      });
      
      return {
        available: !conflict,
        conflictingEvent: conflict
      };
    } catch (error) {
      console.error("[useCalendarEvents] Error in checkTimeSlotAvailability:", error);
      // If there's an error, we'll be cautious and say the slot is unavailable
      return { available: false };
    }
  };

  // Set up queries to fetch data
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: true, // Always enable to support both authenticated and public modes
    staleTime: 1000 * 60, // 1 minute
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Set up mutations for CRUD operations
  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      // Also invalidate public events query if the event has a business_id
      if (data?.business_id) {
        queryClient.invalidateQueries({ queryKey: ['public-events', data.business_id] });
      }
    },
  });

  const createEventRequestMutation = useMutation({
    mutationFn: createEventRequest,
    onSuccess: (data) => {
      // After successfully creating a request, invalidate the public events query
      if (data?.business_id) {
        queryClient.invalidateQueries({ queryKey: ['public-events', data.business_id] });
      }
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      // Also invalidate public events queries for any business this event might belong to
      if (data?.business_id) {
        queryClient.invalidateQueries({ queryKey: ['public-events', data.business_id] });
      }
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      // Also invalidate public events queries for all businesses
      queryClient.invalidateQueries({ queryKey: ['public-events'] });
    },
  });

  return {
    events,
    isLoading,
    error,
    getPublicEvents,
    createEvent: createEventMutation.mutateAsync,
    createEventRequest: createEventRequestMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    checkTimeSlotAvailability,
  };
};
