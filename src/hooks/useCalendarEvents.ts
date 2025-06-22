
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

  // Core deletion function that actually removes events from database
  const deleteEvent = async (id: string, deleteChoice?: 'this' | 'series'): Promise<void> => {
    if (!user) {
      throw new Error("User not authenticated.");
    }

    console.log("=== STARTING DELETE OPERATION ===");
    console.log("Delete ID:", id);
    console.log("Delete choice:", deleteChoice);

    try {
      // Handle virtual recurring instances (frontend-generated IDs)
      if (id.includes('-')) {
        console.log("Handling virtual recurring instance");
        
        if (deleteChoice === 'series') {
          // Extract parent ID and delete the entire series
          const parentId = id.split('-')[0];
          console.log("Deleting series for virtual instance, parent ID:", parentId);
          
          const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', parentId);

          if (error) {
            console.error("Error deleting series:", error);
            throw error;
          }
          
          console.log("Successfully deleted entire series");
        }
        // For 'this' choice on virtual instances, we just refresh to remove from UI
        
        // Always refresh after virtual instance operations
        await queryClient.invalidateQueries({ queryKey: ['events'] });
        await queryClient.invalidateQueries({ queryKey: ['business-events'] });
        console.log("=== DELETE COMPLETED (VIRTUAL INSTANCE) ===");
        return;
      }

      // Handle real database events
      console.log("Handling real database event");
      
      if (deleteChoice === 'series') {
        // Check if this event has a parent_event_id (it's an instance)
        const { data: eventData, error: fetchError } = await supabase
          .from('events')
          .select('parent_event_id, is_recurring')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error("Error fetching event data:", fetchError);
          throw fetchError;
        }

        // If it has a parent, delete the parent; otherwise delete this event
        const targetId = eventData?.parent_event_id || id;
        console.log("Deleting entire series, target ID:", targetId);
        
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', targetId);

        if (error) {
          console.error("Error deleting event series:", error);
          throw error;
        }
        
        console.log("Successfully deleted entire series");
      } else {
        // Delete single event
        console.log("Deleting single event:", id);
        
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', id);

        if (error) {
          console.error("Error deleting single event:", error);
          throw error;
        }
        
        console.log("Successfully deleted single event");
      }

      // Force refresh all queries to ensure UI updates
      console.log("Forcing query refresh...");
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['business-events'] });
      
      // Also force a manual refetch to ensure immediate update
      await refetch();
      
      console.log("=== DELETE COMPLETED SUCCESSFULLY ===");
      
    } catch (error) {
      console.error("=== DELETE FAILED ===", error);
      throw error;
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
