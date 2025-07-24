
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUnifiedCalendarEvents, deleteCalendarEvent, clearCalendarCache } from '@/services/calendarService';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchEvents = async (): Promise<CalendarEventType[]> => {
    const targetUserId = businessUserId || user?.id;
    if (!targetUserId) return [];
    
    const { events, bookings } = await getUnifiedCalendarEvents(businessId, targetUserId);
    const allEvents = [...events, ...bookings];

    return allEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    );
  };

  const queryKey = businessId ? ['business-events', businessId] : ['events', user?.id];

  const {
    data: events = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: fetchEvents,
    enabled: !!(businessUserId || user?.id),
  });

  useEffect(() => {
    const handleRealtimeUpdate = (source: string) => {
      console.log(`[useCalendarEvents] Real-time update from ${source}, refetching.`);
      queryClient.invalidateQueries({ queryKey });
    };

    const eventsChannel = supabase
      .channel(`calendar-events-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => handleRealtimeUpdate('events'))
      .subscribe();

    const bookingsChannel = supabase
      .channel(`calendar-bookings-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, () => handleRealtimeUpdate('bookings'))
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [queryClient, queryKey]);

  // Mutation for creating events (no changes needed here)
  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
         p_event_data: {
           title: eventData.user_surname || eventData.title,
           user_surname: eventData.user_surname,
           user_number: eventData.user_number,
           social_network_link: eventData.social_network_link,
           event_notes: eventData.event_notes,
           event_name: eventData.event_name,
           start_date: eventData.start_date,
           end_date: eventData.end_date,
           payment_status: eventData.payment_status || 'not_paid',
           payment_amount: eventData.payment_amount?.toString() || '',
           type: eventData.type || 'event',
           is_recurring: eventData.is_recurring || false,
           repeat_pattern: eventData.repeat_pattern,
           repeat_until: eventData.repeat_until
         },
         p_additional_persons: [],
         p_user_id: user.id,
         p_event_id: null
       });
      if (error) throw error;
      return { id: savedEventId, ...eventData } as CalendarEventType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Success", description: "Event created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create event.", variant: "destructive" });
    },
  });

  // Mutation for updating events (no changes needed here)
  const updateEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType> & { id: string }) => {
      if (!user?.id) throw new Error("User not authenticated");
      if (eventData.type === 'booking_request') {
        const { error } = await supabase.from('booking_requests').update({
          title: eventData.user_surname || eventData.title,
          requester_name: eventData.user_surname || eventData.title,
          requester_phone: eventData.user_number,
          requester_email: eventData.social_network_link,
          description: eventData.event_notes,
          start_date: eventData.start_date,
          end_date: eventData.end_date,
          payment_status: eventData.payment_status || 'not_paid',
          payment_amount: eventData.payment_amount || null,
        }).eq('id', eventData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('save_event_with_persons', {
          p_event_data: {
            title: eventData.user_surname || eventData.title,
            user_surname: eventData.user_surname,
            user_number: eventData.user_number,
            social_network_link: eventData.social_network_link,
            event_notes: eventData.event_notes,
            event_name: eventData.event_name,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            payment_status: eventData.payment_status || 'not_paid',
            payment_amount: eventData.payment_amount?.toString() || '',
            type: eventData.type || 'event',
            is_recurring: eventData.is_recurring || false,
            repeat_pattern: eventData.repeat_pattern,
            repeat_until: eventData.repeat_until
          },
          p_additional_persons: [],
          p_user_id: user.id,
          p_event_id: eventData.id
        });
        if (error) throw error;
      }
      return eventData as CalendarEventType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Success", description: "Event updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update event.", variant: "destructive" });
    },
  });

  // <<< THIS IS THE UPDATED DELETE MUTATION >>>
  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      // The new service function is simpler and more robust.
      // We just pass the ID and the choice for recurring events.
      return deleteCalendarEvent(id, deleteChoice);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Event deleted successfully." });
      // Invalidate queries to trigger a refetch of the calendar data
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      console.error("[useCalendarEvents] Error deleting event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  return {
    events,
    isLoading,
    error,
    refetch,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};
