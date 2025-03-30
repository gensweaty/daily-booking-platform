
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";

export const useCalendarEvents = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const getEvents = async (): Promise<CalendarEventType[]> => {
    console.log("Fetching calendar events for user:", user?.id);
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .or(`user_id.eq.${user?.id},business_id.not.is.null`)
      .order('start_date', { ascending: true });

    if (error) {
      console.error("Error fetching calendar events:", error);
      throw error;
    }
    
    console.log(`Retrieved ${data?.length || 0} events for calendar`);
    return data || [];
  };

  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to create events");
    
    console.log("Creating new event:", event);
    
    const { data, error } = await supabase
      .from('events')
      .insert([{ ...event, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error("Error creating event:", error);
      throw error;
    }
    
    console.log("Event created successfully:", data);
    return data;
  };

  const updateEvent = async ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    
    console.log(`Updating event ${id} with:`, updates);
    
    // We need to check if this event belongs to the current user or is associated with their business
    const { data: eventData, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
      
    if (fetchError) {
      console.error("Error fetching event for update:", fetchError);
      throw fetchError;
    }
    
    if (eventData.user_id !== user.id) {
      // Check if user has permission to update this event
      // This would need to be implemented based on your permission system
      console.log("User is updating an event they don't own directly");
    }
    
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      throw error;
    }
    
    console.log("Event updated successfully:", data);
    return data;
  };

  const deleteEvent = async (id: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    console.log(`Deleting event ${id}`);

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
    
    console.log("Event deleted successfully");
  };

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 30000, // Refresh every 30 seconds to ensure sync
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
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
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};
