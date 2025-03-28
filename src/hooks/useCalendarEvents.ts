
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

  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      if (!user) throw new Error("User must be authenticated to create events");
      
      const eventData = { ...event, user_id: user.id };
      console.log("Creating event:", eventData);
      
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
      
      console.log(`Updating event ${id} with:`, updates);
      
      const { data, error } = await supabase
        .from('events')
        .update(updates)
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

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: true, // Always enable to support both authenticated and public modes
    staleTime: 1000 * 60, // 1 minute
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

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
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
    },
  });

  return {
    events,
    isLoading,
    error,
    createEvent: createEventMutation.mutateAsync,
    createEventRequest: createEventRequestMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};
