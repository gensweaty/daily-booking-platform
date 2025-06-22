
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
      allEvents.push(event);

      if (event.is_recurring && event.repeat_pattern) {
        try {
          const pattern = parseRecurringPattern(event.repeat_pattern);
          const repeatUntil = event.repeat_until ? new Date(event.repeat_until) : yearEnd;
          
          const recurringInstances = generateRecurringInstances(event, pattern, repeatUntil);
          
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

    const dbEventData = {
      title: eventData.title || '',
      user_surname: eventData.user_surname || '',
      user_number: eventData.user_number || '',
      social_network_link: eventData.social_network_link || '',
      event_notes: eventData.event_notes || '',
      start_date: eventData.start_date || new Date().toISOString(),
      end_date: eventData.end_date || new Date().toISOString(),
      type: eventData.type || 'event',
      payment_status: eventData.payment_status || 'not_paid',
      payment_amount: eventData.payment_amount || null,
      user_id: user.id,
      repeat_pattern: eventData.repeat_pattern || null,
      repeat_until: eventData.repeat_until || null,
      is_recurring: eventData.is_recurring || false,
      parent_event_id: eventData.parent_event_id || null,
      recurrence_instance_date: eventData.recurrence_instance_date || null,
      event_name: eventData.event_name || null,
      language: eventData.language || 'en'
    };

    const { data, error } = await supabase
      .from('events')
      .insert(dbEventData)
      .select('*')
      .single();

    if (error) {
      console.error("Error creating event:", error);
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });

    return data;
  };

  const updateEvent = async (eventData: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) {
      throw new Error("User not authenticated.");
    }

    if (eventData.isRecurringInstance && !eventData.id?.includes('-')) {
      delete eventData.id;
      return createEvent(eventData);
    }

    const updateData: any = {};
    
    if (eventData.title !== undefined) updateData.title = eventData.title;
    if (eventData.user_surname !== undefined) updateData.user_surname = eventData.user_surname;
    if (eventData.user_number !== undefined) updateData.user_number = eventData.user_number;
    if (eventData.social_network_link !== undefined) updateData.social_network_link = eventData.social_network_link;
    if (eventData.event_notes !== undefined) updateData.event_notes = eventData.event_notes;
    if (eventData.start_date !== undefined) updateData.start_date = eventData.start_date;
    if (eventData.end_date !== undefined) updateData.end_date = eventData.end_date;
    if (eventData.type !== undefined) updateData.type = eventData.type;
    if (eventData.payment_status !== undefined) updateData.payment_status = eventData.payment_status;
    if (eventData.payment_amount !== undefined) updateData.payment_amount = eventData.payment_amount;
    if (eventData.repeat_pattern !== undefined) updateData.repeat_pattern = eventData.repeat_pattern;
    if (eventData.repeat_until !== undefined) updateData.repeat_until = eventData.repeat_until;
    if (eventData.is_recurring !== undefined) updateData.is_recurring = eventData.is_recurring;
    if (eventData.parent_event_id !== undefined) updateData.parent_event_id = eventData.parent_event_id;
    if (eventData.recurrence_instance_date !== undefined) updateData.recurrence_instance_date = eventData.recurrence_instance_date;
    if (eventData.event_name !== undefined) updateData.event_name = eventData.event_name;
    if (eventData.language !== undefined) updateData.language = eventData.language;

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventData.id)
      .select('*')
      .single();

    if (error) {
      console.error("Error updating event:", error);
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });

    return data;
  };

  // Simplified delete function that properly handles all cases
  const deleteEvent = async (eventId: string, deleteChoice?: 'this' | 'series'): Promise<{ success: boolean }> => {
    if (!user) {
      throw new Error("User not authenticated.");
    }

    console.log("=== DELETE EVENT START ===");
    console.log("Event ID:", eventId);
    console.log("Delete choice:", deleteChoice);

    try {
      // Handle virtual recurring instances (frontend-generated IDs like "parent-id-2024-01-01")
      if (eventId.includes('-') && eventId.split('-').length > 2) {
        console.log("Virtual recurring instance detected");
        
        if (deleteChoice === 'series') {
          // Extract parent ID and delete the entire series
          const parentId = eventId.split('-')[0];
          console.log("Deleting parent series:", parentId);
          
          const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', parentId);

          if (error) {
            console.error("Error deleting series:", error);
            throw error;
          }
        }
        
        // For virtual instances (deleteChoice 'this' or no choice), just refresh UI
        await queryClient.invalidateQueries({ queryKey: ['events'] });
        await queryClient.invalidateQueries({ queryKey: ['business-events'] });
        console.log("Virtual instance handled successfully");
        return { success: true };
      }

      // Handle real database events
      if (deleteChoice === 'series') {
        // Get the event to check if it has a parent
        const { data: eventData, error: fetchError } = await supabase
          .from('events')
          .select('parent_event_id, is_recurring')
          .eq('id', eventId)
          .single();

        if (fetchError) {
          console.error("Error fetching event:", fetchError);
          throw fetchError;
        }

        // If this is a child instance, delete the parent. If it's already a parent, delete itself.
        const targetId = eventData?.parent_event_id || eventId;
        console.log("Deleting series, target ID:", targetId);
        
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', targetId);

        if (error) {
          console.error("Error deleting series:", error);
          throw error;
        }
      } else {
        // Simple single event deletion
        console.log("Deleting single event:", eventId);
        
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId);

        if (error) {
          console.error("Error deleting event:", error);
          throw error;
        }
      }

      // Force refresh all queries
      console.log("Refreshing queries...");
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['business-events'] });
      await refetch();
      
      console.log("=== DELETE COMPLETED SUCCESSFULLY ===");
      return { success: true };
      
    } catch (error) {
      console.error("=== DELETE FAILED ===", error);
      throw error; // Re-throw to let the UI handle the error
    }
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
