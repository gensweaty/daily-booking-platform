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
    const eventData = { ...event };
    
    if (user && !eventData.user_id) {
      eventData.user_id = user.id;
    }
    
    const { data, error } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateEvent = async ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }): Promise<CalendarEventType> => {
    let query = supabase
      .from('events')
      .update(updates)
      .eq('id', id);
    
    if (user && !businessId) {
      query = query.eq('user_id', user.id);
    }
    
    const { data, error } = await query
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteEvent = async (id: string): Promise<void> => {
    let query = supabase
      .from('events')
      .delete()
      .eq('id', id);
    
    if (user && !businessId) {
      query = query.eq('user_id', user.id);
    }

    const { error } = await query;

    if (error) throw error;
  };

  const approveEvent = async (id: string): Promise<CalendarEventType> => {
    const { data, error } = await supabase
      .from('events')
      .update({ status: 'confirmed' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', user?.id, businessId],
    queryFn: getEvents,
    enabled: true,
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

  const approveEventMutation = useMutation({
    mutationFn: approveEvent,
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
    approveEvent: approveEventMutation.mutateAsync,
  };
};
