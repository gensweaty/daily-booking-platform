
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/lib/types/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { generateRecurringInstances, parseRecurringPattern } from '@/lib/recurringEvents';
import { endOfYear, startOfYear } from 'date-fns';

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rawEvents, isLoading, error, refetch } = useQuery({
    queryKey: businessId 
      ? ['business-events', businessId] 
      : ['events', user?.id],
    queryFn: async () => {
      if (businessId) {
        // For business events, we need to query by user_id since there's no business_id column
        const { data: businessProfile, error: profileError } = await supabase
          .from('business_profiles')
          .select('user_id')
          .eq('id', businessId)
          .single();

        if (profileError || !businessProfile) {
          console.error("Error fetching business profile:", profileError);
          return [];
        }

        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessProfile.user_id)
          .is('deleted_at', null)
          .order('start_date', { ascending: true });

        if (error) {
          console.error("Error fetching business events:", error);
          throw error;
        }

        return data;
      } else if (businessUserId) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessUserId)
          .is('deleted_at', null)
          .order('start_date', { ascending: true });

        if (error) {
          console.error("Error fetching business user events:", error);
          throw error;
        }

        return data;
      } else if (user) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('start_date', { ascending: true });

        if (error) {
          console.error("Error fetching events:", error);
          throw error;
        }

        return data;
      }

      return [];
    },
    enabled: !!user || !!businessId || !!businessUserId
  });

  // Process events to include recurring instances
  const events = useMemo(() => {
    if (!rawEvents) return [];

    const allEvents: CalendarEventType[] = [];
    const currentYear = new Date().getFullYear();
    const yearStart = startOfYear(new Date(currentYear, 0, 1));
    const yearEnd = endOfYear(new Date(currentYear, 11, 31));

    rawEvents.forEach((event: CalendarEventType) => {
      // Add the original event
      allEvents.push(event);

      // Generate recurring instances if this is a recurring parent event
      if (event.is_recurring && event.repeat_pattern) {
        try {
          const pattern = parseRecurringPattern(event.repeat_pattern);
          const repeatUntil = event.repeat_until ? new Date(event.repeat_until) : yearEnd;
          
          const recurringInstances = generateRecurringInstances(event, pattern, repeatUntil);
          
          // Convert recurring instances to CalendarEventType and add to events
          recurringInstances.forEach(instance => {
            allEvents.push({
              ...event,
              id: instance.id,
              start_date: instance.start_date,
              end_date: instance.end_date,
              isRecurringInstance: true,
              parentEventId: instance.parentEventId,
              instanceDate: instance.instanceDate,
              parent_event_id: event.id,
              is_recurring: false,
              repeat_pattern: undefined,
              repeat_until: undefined
            });
          });
        } catch (error) {
          console.error('Error generating recurring instances:', error);
        }
      }
    });

    return allEvents;
  }, [rawEvents]);

  const createEvent = async (eventData: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) {
      throw new Error("User not authenticated.");
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        ...eventData,
        user_id: user.id,
        repeat_pattern: eventData.repeat_pattern || null,
        repeat_until: eventData.repeat_until || null,
        is_recurring: eventData.is_recurring || false,
        parent_event_id: eventData.parent_event_id || null,
        recurrence_instance_date: eventData.recurrence_instance_date || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error("Error creating event:", error);
      throw error;
    }

    // Invalidate the cache to refetch events
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });

    return data;
  };

  const updateEvent = async (eventData: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) {
      throw new Error("User not authenticated.");
    }

    // Handle recurring instance updates
    if (eventData.isRecurringInstance && !eventData.id?.includes('-')) {
      // This is a frontend-generated recurring instance being converted to standalone
      delete eventData.id; // Remove the generated ID
      return createEvent(eventData); // Create as new event
    }

    const { data, error } = await supabase
      .from('events')
      .update({
        ...eventData,
        repeat_pattern: eventData.repeat_pattern,
        repeat_until: eventData.repeat_until,
        is_recurring: eventData.is_recurring,
        parent_event_id: eventData.parent_event_id,
        recurrence_instance_date: eventData.recurrence_instance_date,
      })
      .eq('id', eventData.id)
      .select('*')
      .single();

    if (error) {
      console.error("Error updating event:", error);
      throw error;
    }

    // Invalidate the cache to refetch events
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });

    return data;
  };

  const deleteEvent = async (id: string) => {
    if (!user) {
      throw new Error("User not authenticated.");
    }

    // Handle deletion of recurring series
    if (id.includes('-')) {
      // This is a frontend-generated recurring instance ID
      const parentId = id.split('-')[0];
      
      // For now, we'll just refresh the data to remove the instance from view
      // In a more complex implementation, you might want to store exclusion dates
      queryClient.invalidateQueries({ queryKey: ['events'] });
      return;
    }

    // Delete the event (and cascade to instances if it's a parent)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting event:", error);
      throw error;
    }

    // Invalidate the cache to refetch events
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });
  };

  return {
    events,
    isLoading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    refetch,
  };
};
