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

    // Ensure required fields are present and create a clean object with only database columns
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

    // Clean the data for update - only include database columns
    const updateData: any = {};
    
    // Only include fields that exist and are not undefined
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

    // Invalidate the cache to refetch events
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });

    return data;
  };

  const deleteEvent = async (id: string, deleteChoice?: 'this' | 'series') => {
    if (!user) {
      throw new Error("User not authenticated.");
    }

    console.log("Deleting event with ID:", id, "Delete choice:", deleteChoice);

    // Handle deletion based on the choice made in the dialog
    if (deleteChoice === 'this') {
      // Delete only this instance
      if (id.includes('-')) {
        // This is a frontend-generated recurring instance ID, just refresh to remove from view
        console.log("Deleting frontend-generated recurring instance:", id);
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['business-events'] });
        return;
      } else {
        // This is a real database event, delete it normally
        console.log("Deleting single database event:", id);
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', id);

        if (error) {
          console.error("Error deleting single event:", error);
          throw error;
        }
      }
    } else if (deleteChoice === 'series') {
      // Delete entire series - find and delete the parent event
      let parentId = id;
      
      if (id.includes('-')) {
        // Extract parent ID from frontend-generated instance ID
        parentId = id.split('-')[0];
        console.log("Extracted parent ID from recurring instance:", parentId);
      } else {
        // Check if this event has a parent_event_id (it's a child instance)
        const { data: eventData } = await supabase
          .from('events')
          .select('parent_event_id, is_recurring')
          .eq('id', id)
          .single();
          
        if (eventData?.parent_event_id) {
          parentId = eventData.parent_event_id;
          console.log("Found parent ID from child event:", parentId);
        }
      }

      console.log("Deleting entire series with parent ID:", parentId);
      
      // Delete the parent event (this will cascade to delete all child instances due to foreign key constraint)
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', parentId);

      if (error) {
        console.error("Error deleting event series:", error);
        throw error;
      }
    } else {
      // No choice specified - this is for non-recurring events or fallback
      console.log("Deleting event without choice (non-recurring):", id);
      
      if (id.includes('-')) {
        // Frontend-generated ID, just refresh
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['business-events'] });
        return;
      }

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Error deleting event:", error);
        throw error;
      }
    }

    // Invalidate the cache to refetch events
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });
    
    console.log("Event deletion completed successfully");
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
