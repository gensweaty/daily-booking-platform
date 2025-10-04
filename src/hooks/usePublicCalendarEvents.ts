import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export const usePublicCalendarEvents = (
  boardUserId: string,
  externalUserName: string
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch events using RPC function for public access
  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['publicCalendarEvents', boardUserId],
    queryFn: async () => {
      console.log('[usePublicCalendarEvents] Fetching events for user:', boardUserId);
      const { data, error } = await supabase
        .rpc('get_public_events_by_user_id', { user_id_param: boardUserId });
      
      if (error) {
        console.error('[usePublicCalendarEvents] Error fetching events:', error);
        throw error;
      }
      
      console.log('[usePublicCalendarEvents] Fetched events:', data?.length || 0);
      return (data || []) as CalendarEventType[];
    },
    enabled: !!boardUserId,
    refetchInterval: 1500,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!boardUserId) return;

    console.log('[usePublicCalendarEvents] Setting up real-time subscriptions');

    let debounceTimer: NodeJS.Timeout;

    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
        refetch();
      }, 100);
    };

    // Subscribe to events table changes
    const eventsChannel = supabase
      .channel(`public_calendar_events_${boardUserId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${boardUserId}`
        },
        (payload) => {
          console.log('[usePublicCalendarEvents] Events table changed:', payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      console.log('[usePublicCalendarEvents] Cleaning up real-time subscriptions');
      supabase.removeChannel(eventsChannel);
    };
  }, [boardUserId, queryClient, refetch]);

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      console.log('[usePublicCalendarEvents] Creating event with data:', eventData);
      
      const formattedData = {
        title: eventData.user_surname || eventData.title || 'Untitled Event',
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
        repeat_until: eventData.repeat_until,
        reminder_at: eventData.reminder_at,
        email_reminder_enabled: eventData.email_reminder_enabled || false
      };

      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: formattedData,
        p_additional_persons: [],
        p_user_id: boardUserId,
        p_event_id: null,
        p_created_by_type: 'sub_user',
        p_created_by_name: externalUserName,
        p_last_edited_by_type: 'sub_user',
        p_last_edited_by_name: externalUserName
      });

      if (error) {
        console.error('[usePublicCalendarEvents] RPC error:', error);
        throw error;
      }

      if (!savedEventId) {
        throw new Error('No event ID returned from RPC call');
      }

      // Fetch the complete event data
      const { data: completeEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', savedEventId)
        .single();
        
      if (fetchError) {
        console.error('[usePublicCalendarEvents] Error fetching created event:', fetchError);
        throw fetchError;
      }
      
      console.log('[usePublicCalendarEvents] Event created successfully:', completeEvent);
      
      // Send booking approval email just like in dashboard
      try {
        console.log('[usePublicCalendarEvents] Sending booking approval email...');
        
        // Get business profile for business name
        const { data: businessProfile } = await supabase
          .from('business_profiles')
          .select('business_name, contact_address')
          .eq('user_id', boardUserId)
          .single();
        
        await supabase.functions.invoke('send-booking-approval-email', {
          body: {
            eventId: completeEvent.id,
            recipientEmail: completeEvent.social_network_link || completeEvent.user_number, // Use social_network_link as email field
            fullName: completeEvent.user_surname || completeEvent.title,
            businessName: businessProfile?.business_name || 'SmartBookly.Com',
            paymentStatus: completeEvent.payment_status || 'not_paid',
            paymentAmount: completeEvent.payment_amount,
            language: completeEvent.language || 'en',
            eventNotes: completeEvent.event_notes || '',
            source: 'event-creation',
            hasBusinessAddress: !!businessProfile?.contact_address,
            startDate: completeEvent.start_date,
            endDate: completeEvent.end_date
          }
        });
        console.log('[usePublicCalendarEvents] Booking approval email sent successfully');
      } catch (emailError) {
        console.error('[usePublicCalendarEvents] Failed to send booking approval email:', emailError);
        // Don't throw error for email failure, just log it
      }
      
      return completeEvent as CalendarEventType;
    },
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error: any) => {
      console.error('[usePublicCalendarEvents] Error creating event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType> & { id: string }) => {
      console.log('[usePublicCalendarEvents] Updating event with data:', eventData);
      
      const formattedData = {
        title: eventData.user_surname || eventData.title || 'Untitled Event',
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
        repeat_until: eventData.repeat_until,
        reminder_at: eventData.reminder_at,
        email_reminder_enabled: eventData.email_reminder_enabled || false
      };

      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: formattedData,
        p_additional_persons: [],
        p_user_id: boardUserId,
        p_event_id: eventData.id,
        p_created_by_type: 'sub_user',
        p_created_by_name: externalUserName,
        p_last_edited_by_type: 'sub_user',
        p_last_edited_by_name: externalUserName
      });

      if (error) {
        console.error('[usePublicCalendarEvents] Update RPC error:', error);
        throw error;
      }

      if (!savedEventId) {
        throw new Error('No event ID returned from update RPC call');
      }

      // Fetch the complete updated event data
      const { data: completeEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', savedEventId)
        .single();
        
      if (fetchError) {
        console.error('[usePublicCalendarEvents] Error fetching updated event:', fetchError);
        throw fetchError;
      }
      
      console.log('[usePublicCalendarEvents] Event updated successfully:', completeEvent);
      return completeEvent as CalendarEventType;
    },
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('[usePublicCalendarEvents] Error updating event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ id: eventId, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
      console.log('[usePublicCalendarEvents] Deleting event:', eventId, 'choice:', deleteChoice);
      
      const { data: result, error } = await supabase
        .rpc('delete_recurring_series', {
          p_event_id: eventId,
          p_user_id: boardUserId,
          p_delete_choice: deleteChoice || 'this'
        });

      if (error) {
        console.error('[usePublicCalendarEvents] Delete RPC error:', error);
        throw error;
      }
      
      console.log('[usePublicCalendarEvents] Event deleted successfully:', result);
      return { success: true };
    },
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('[usePublicCalendarEvents] Error deleting event:', error);
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
    error: error as Error | null,
    refetch,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};