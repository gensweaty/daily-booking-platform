
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
      
      // Only include business_id if it's explicitly provided and not null/undefined
      if (eventData.business_id === null || eventData.business_id === undefined) {
        delete eventData.business_id;
      }
      
      console.log("Creating event with data:", eventData);
      
      const { data, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (error) {
        console.error("Error creating event:", error);
        throw error;
      }
      
      console.log("Event created successfully:", data);
      return data;
    } catch (err) {
      console.error("Failed to create event:", err);
      throw err;
    }
  };

  const updateEvent = async ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }): Promise<CalendarEventType> => {
    try {
      if (!user) throw new Error("User must be authenticated to update events");
      
      // Create a clean copy of updates to avoid modifying the original
      const cleanUpdates = { ...updates };
      
      // Only include business_id if it's explicitly provided and not null/undefined
      if (cleanUpdates.business_id === null || cleanUpdates.business_id === undefined) {
        delete cleanUpdates.business_id;
      }
      
      console.log(`Updating event ${id} with:`, cleanUpdates);
      
      const { data, error } = await supabase
        .from('events')
        .update(cleanUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating event:", error);
        throw error;
      }
      
      console.log("Event updated successfully:", data);
      return data;
    } catch (err) {
      console.error("Failed to update event:", err);
      throw err;
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    try {
      if (!user) throw new Error("User must be authenticated to delete events");
      
      console.log(`Deleting event ${id}`);
      
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error("Error deleting event:", error);
        throw error;
      }
      
      console.log("Event deleted successfully");
    } catch (err) {
      console.error("Failed to delete event:", err);
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

      console.log("Creating event request:", event);
      
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
        console.error("Error creating event request:", error);
        throw error;
      }
      
      console.log("Event request created successfully:", data);
      return data;
    } catch (error) {
      console.error("Error in createEventRequest:", error);
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
        console.error("Error checking for existing events:", eventsError);
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
        console.error("Error checking for approved requests:", requestsError);
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
      console.error("Error in checkTimeSlotAvailability:", error);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
    },
  });

  const createEventRequestMutation = useMutation({
    mutationFn: createEventRequest,
    onSuccess: () => {
      // No need to invalidate queries here as the request won't show in the calendar
      // until approved by the business owner
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      // Also invalidate public events queries for any business this event might belong to
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['public-events'] });
      }
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      // Also invalidate public events queries for any business this event might belong to
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
