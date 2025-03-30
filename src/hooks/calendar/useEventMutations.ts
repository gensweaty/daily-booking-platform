import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { createEvent as apiCreateEvent, updateEvent as apiUpdateEvent, deleteEvent as apiDeleteEvent, getEvents as apiGetEvents } from "@/lib/api";

export const useEventMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidateAllEventQueries = (businessId?: string) => {
    console.log("[useEventMutations] Invalidating all event queries");
    
    // Invalidate all general event queries
    queryClient.invalidateQueries({ queryKey: ['events'] });
    
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['events', user.id] });
    }
    
    // Invalidate all public event queries
    queryClient.invalidateQueries({ queryKey: ['public-events'] });
    queryClient.invalidateQueries({ queryKey: ['all-business-events'] });
    
    // Invalidate the business-specific queries
    if (businessId) {
      console.log(`[useEventMutations] Invalidating business events for ID: ${businessId}`);
      queryClient.invalidateQueries({ queryKey: ['public-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['all-business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['all-event-requests', businessId] });
      queryClient.invalidateQueries({ queryKey: ['api-combined-events', businessId] });
    }
    
    // Try to find the user's business and invalidate its queries too
    if (user?.id) {
      const checkUserBusiness = async () => {
        try {
          const { data: userBusiness } = await supabase
            .from('businesses')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (userBusiness?.id && userBusiness.id !== businessId) {
            console.log(`[useEventMutations] Also invalidating user's business: ${userBusiness.id}`);
            queryClient.invalidateQueries({ queryKey: ['public-events', userBusiness.id] });
            queryClient.invalidateQueries({ queryKey: ['all-business-events', userBusiness.id] });
            queryClient.invalidateQueries({ queryKey: ['direct-business-events', userBusiness.id] });
            queryClient.invalidateQueries({ queryKey: ['all-event-requests', userBusiness.id] });
            queryClient.invalidateQueries({ queryKey: ['api-combined-events', userBusiness.id] });
          }
        } catch (error) {
          console.error("[useEventMutations] Error finding user's business:", error);
        }
      };
      
      checkUserBusiness();
    }
    
    fetchAllEvents();
  };

  const fetchAllEvents = async () => {
    try {
      if (user?.id) {
        console.log("[useEventMutations] Force refetching user events");
        const userEvents = await apiGetEvents();
        queryClient.setQueryData(['events', user.id], userEvents);
        queryClient.setQueryData(['events'], userEvents);
      }
      
      const { data: userBusiness } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();
        
      if (userBusiness?.id) {
        console.log(`[useEventMutations] Force refetching business events for business: ${userBusiness.id}`);
        
        const { data: directEvents } = await supabase
          .from('events')
          .select('*')
          .eq('business_id', userBusiness.id);
          
        queryClient.setQueryData(['direct-business-events', userBusiness.id], directEvents);
        
        const { data: approvedRequests } = await supabase
          .from('event_requests')
          .select('*')
          .eq('business_id', userBusiness.id)
          .eq('status', 'approved');
          
        queryClient.setQueryData(['approved-event-requests', userBusiness.id], approvedRequests);
      }
    } catch (error) {
      console.error("[useEventMutations] Error in fetchAllEvents:", error);
    }
  };

  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      if (!user) throw new Error("User must be authenticated to create events");
      
      console.log("[useEventMutations] Creating event:", JSON.stringify(event));
      
      // Create a clean copy of data to avoid modifying the original
      const eventData = { ...event };
      
      // Set user_id for the event
      eventData.user_id = user.id;
      
      // Get the user's business if available but don't fail if not found
      if (!eventData.business_id) {
        try {
          // Try to get the first business owned by this user
          const { data: userBusiness } = await supabase
            .from('businesses')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (userBusiness?.id) {
            eventData.business_id = userBusiness.id;
            console.log("[useEventMutations] Found user's business ID:", userBusiness.id);
          }
        } catch (businessError) {
          console.warn("[useEventMutations] Error finding user's business:", businessError);
          // Continue without business_id
        }
      }
      
      console.log("[useEventMutations] Creating event with data:", JSON.stringify(eventData));
      
      const data = await apiCreateEvent(eventData);
      
      console.log("[useEventMutations] Event created successfully:", data);
      
      // Invalidate ALL relevant queries to ensure sync
      invalidateAllEventQueries(data.business_id);
      
      return data;
    } catch (err) {
      console.error("[useEventMutations] Failed to create event:", err);
      throw err;
    }
  };

  const updateEvent = async (updates: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      if (!user) throw new Error("User must be authenticated to update events");
      
      // Get the ID from the updates object
      const id = updates.id;
      if (!id) throw new Error("Event ID is required for updates");
      
      console.log(`[useEventMutations] Updating event ${id} with data:`, JSON.stringify(updates));
      
      // Get the current event's business_id before updating
      let currentBusinessId = updates.business_id;
      
      if (!currentBusinessId) {
        try {
          const { data: existingEvent } = await supabase
            .from('events')
            .select('business_id')
            .eq('id', id)
            .single();
          
          currentBusinessId = existingEvent?.business_id;
          console.log("[useEventMutations] Current business_id:", currentBusinessId);
        } catch (fetchError) {
          console.warn("[useEventMutations] Error fetching current event business_id:", fetchError);
        }
      }
      
      const data = await apiUpdateEvent(updates);
      
      console.log("[useEventMutations] Event updated successfully:", data);
      
      // Invalidate ALL relevant queries for both the old and new business IDs
      invalidateAllEventQueries(currentBusinessId);
      if (data.business_id && data.business_id !== currentBusinessId) {
        invalidateAllEventQueries(data.business_id);
      }
      
      return data;
    } catch (err) {
      console.error("[useEventMutations] Failed to update event:", err);
      throw err;
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    try {
      if (!user) throw new Error("User must be authenticated to delete events");
      
      // Get the current event's business_id before deleting
      let currentBusinessId: string | undefined;
      
      try {
        const { data: existingEvent } = await supabase
          .from('events')
          .select('business_id')
          .eq('id', id)
          .single();
        
        currentBusinessId = existingEvent?.business_id;
        console.log(`[useEventMutations] Deleting event ${id} with business_id:`, currentBusinessId);
      } catch (fetchError) {
        console.warn("[useEventMutations] Error fetching current event business_id:", fetchError);
      }
      
      await apiDeleteEvent(id);
      
      console.log("[useEventMutations] Event deleted successfully");
      
      // Invalidate ALL relevant queries
      invalidateAllEventQueries(currentBusinessId);
    } catch (err) {
      console.error("[useEventMutations] Failed to delete event:", err);
      throw err;
    }
  };

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: (data) => {
      invalidateAllEventQueries(data?.business_id);
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: (data) => {
      invalidateAllEventQueries(data?.business_id);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['public-events'] });
      queryClient.invalidateQueries({ queryKey: ['all-business-events'] });
    },
  });

  return {
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    invalidateAllEventQueries,
    fetchAllEvents,
  };
};
