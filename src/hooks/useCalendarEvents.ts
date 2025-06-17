
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/lib/types/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: businessId ? ['business-events', businessId] : ['events', user?.id],
    queryFn: async () => {
      try {
        if (businessId && businessUserId) {
          const { data, error } = await supabase
            .rpc('get_public_events_by_user_id', {
              user_id_param: businessUserId
            });
          
          if (error) throw error;
          return data || [];
        } else if (user?.id) {
          const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('start_date', { ascending: true });
          
          if (error) throw error;
          return data || [];
        }
        return [];
      } catch (err) {
        console.error('Error fetching events:', err);
        throw err;
      }
    },
    enabled: !!user?.id || (!!businessId && !!businessUserId),
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('events')
        .insert([{
          ...eventData,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
    },
    onError: (error) => {
      console.error('Error creating event:', error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!eventData.id) throw new Error('Event ID is required for update');

      // Handle group event updates
      if (eventData.is_group_event) {
        // Update the parent group event
        const { data, error } = await supabase
          .from('events')
          .update({
            title: eventData.group_name,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            is_group_event: true,
            group_name: eventData.group_name,
          })
          .eq('id', eventData.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Regular individual event update
        const { data, error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', eventData.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
    },
    onError: (error) => {
      console.error('Error updating event:', error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      // For group events, we need to handle deletion of child events too
      const { data: eventToDelete } = await supabase
        .from('events')
        .select('is_group_event, parent_group_id')
        .eq('id', eventId)
        .single();

      if (eventToDelete?.is_group_event) {
        // If deleting a group event, delete all child events
        await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('parent_group_id', eventId);
      }

      // Delete the main event (or child event)
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
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
