import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";

interface UseCalendarEventsOptions {
  businessId?: string;
}

export const useCalendarEvents = (options?: UseCalendarEventsOptions) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { businessId } = options || {};

  const getEvents = async () => {
    let query = supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    if (businessId) {
      query = query.eq('business_id', businessId);
    } 
    else if (user) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (businessId && !user) {
      const { data, error } = await supabase
        .from('events')
        .insert([{ ...event, business_id: businessId, status: 'unconfirmed' }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
    
    if (!user) throw new Error("User must be authenticated to create events");
    
    const { data, error } = await supabase
      .from('events')
      .insert([{ 
        ...event, 
        user_id: user.id,
        status: businessId ? 'confirmed' : undefined
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateEvent = async ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    
    let query = supabase
      .from('events')
      .update(updates)
      .eq('id', id);
      
    if (!businessId) {
      query = query.eq('user_id', user.id);
    }
    
    const { data, error } = await query.select().single();

    if (error) throw error;
    return data;
  };

  const deleteEvent = async (id: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    let query = supabase
      .from('events')
      .delete()
      .eq('id', id);
      
    if (!businessId) {
      query = query.eq('user_id', user.id);
    }

    const { error } = await query;
    if (error) throw error;
  };

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', user?.id, businessId],
    queryFn: getEvents,
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id, businessId] });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id, businessId] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id, businessId] });
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
