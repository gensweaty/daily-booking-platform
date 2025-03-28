
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { createEventRequest } from "@/lib/api";

export const useCalendarEvents = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const getEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) throw error;
    return data;
  };

  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    // For public pages, use createEventRequest instead of direct event creation
    if (event.business_id && !user) {
      // This is a public booking request
      const requestData = await createEventRequest({
        business_id: event.business_id,
        title: event.title || "",
        user_surname: event.user_surname,
        user_number: event.user_number,
        social_network_link: event.social_network_link,
        event_notes: event.event_notes,
        start_date: event.start_date || "",
        end_date: event.end_date || "",
        type: event.type,
        payment_status: event.payment_status,
        payment_amount: event.payment_amount
      });
      
      // Return a mock CalendarEventType to satisfy the interface
      return {
        id: requestData.id,
        title: requestData.title,
        start_date: requestData.start_date,
        end_date: requestData.end_date,
        type: requestData.type || "private",
        user_surname: requestData.user_surname,
        user_number: requestData.user_number,
        social_network_link: requestData.social_network_link,
        event_notes: requestData.event_notes,
        payment_status: requestData.payment_status,
        payment_amount: requestData.payment_amount,
        created_at: new Date().toISOString(),
        business_id: requestData.business_id,
        user_id: null
      } as CalendarEventType;
    }
    
    if (!user) throw new Error("User must be authenticated to create events");
    
    const { data, error } = await supabase
      .from('events')
      .insert([{ ...event, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateEvent = async ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteEvent = async (id: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  };

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: !!user,
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['events', user.id] });
      }
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
