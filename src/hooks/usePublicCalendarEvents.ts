import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/hooks/use-toast";

interface UsePublicCalendarEventsReturn {
  events: CalendarEventType[];
  isLoading: boolean;
  error: Error | null;
  createEvent: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent: (params: { id: string; deleteChoice?: "this" | "series" }) => Promise<{ success: boolean; }>;
}

export const usePublicCalendarEvents = (
  boardUserId: string,
  externalUserName: string
): UsePublicCalendarEventsReturn => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch events using RPC function for public access
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['publicCalendarEvents', boardUserId],
    queryFn: async () => {
      console.log('Fetching public calendar events for user:', boardUserId);
      const { data, error } = await supabase
        .rpc('get_public_events_by_user_id', { user_id_param: boardUserId });
      
      if (error) {
        console.error('Error fetching public calendar events:', error);
        throw error;
      }
      
      console.log('Fetched calendar events:', data);
      return (data || []) as CalendarEventType[];
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  // CRITICAL FIX: Create event function that fetches complete data after RPC call
  const createEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      console.log('[PublicCalendarEvents] 🚀 Creating event with data:', data);
      console.log('[PublicCalendarEvents] 👤 External user:', externalUserName);
      console.log('[PublicCalendarEvents] 🏢 Board user ID:', boardUserId);
      
      const eventData = {
        title: data.user_surname || data.title || 'Untitled Event',
        user_surname: data.user_surname,
        user_number: data.user_number,
        social_network_link: data.social_network_link,
        event_notes: data.event_notes,
        event_name: data.event_name,
        start_date: data.start_date,
        end_date: data.end_date,
        payment_status: data.payment_status || 'not_paid',
        payment_amount: data.payment_amount?.toString() || '',
        type: data.type || 'event',
        is_recurring: data.is_recurring || false,
        repeat_pattern: data.repeat_pattern,
        repeat_until: data.repeat_until,
        reminder_at: data.reminder_at,
        email_reminder_enabled: data.email_reminder_enabled || false
      };

      console.log('[PublicCalendarEvents] 📋 Formatted event data:', eventData);
      
      const { data: result, error } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: eventData,
          p_additional_persons: [],
          p_user_id: boardUserId,
          p_event_id: null,
          p_created_by_type: 'sub_user',
          p_created_by_name: externalUserName,
          p_last_edited_by_type: 'sub_user',
          p_last_edited_by_name: externalUserName
        });

      if (error) {
        console.error('[PublicCalendarEvents] ❌ RPC error:', error);
        throw error;
      }
      
      console.log('[PublicCalendarEvents] ✅ Event created with ID:', result);
      
      if (!result) {
        throw new Error('No event ID returned from RPC call');
      }
      
      // CRITICAL FIX: Fetch the complete event data after creation
      const { data: completeEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', result)
        .single();
        
      if (fetchError) {
        console.error('[PublicCalendarEvents] ❌ Error fetching created event:', fetchError);
        throw fetchError;
      }
      
      console.log('[PublicCalendarEvents] ✅ Fetched complete event data:', completeEvent);
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      
      return completeEvent as CalendarEventType;
    } catch (error: any) {
      console.error('[PublicCalendarEvents] ❌ Failed to create event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
      throw error;
    }
  };

  // CRITICAL FIX: Update event function that fetches complete data after RPC call
  const updateEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      console.log('[PublicCalendarEvents] 🔄 Updating event with data:', data);
      console.log('[PublicCalendarEvents] 👤 External user:', externalUserName);
      
      if (!data.id) {
        throw new Error('Event ID is required for update');
      }
      
      const eventData = {
        title: data.user_surname || data.title || 'Untitled Event',
        user_surname: data.user_surname,
        user_number: data.user_number,
        social_network_link: data.social_network_link,
        event_notes: data.event_notes,
        event_name: data.event_name,
        start_date: data.start_date,
        end_date: data.end_date,
        payment_status: data.payment_status || 'not_paid',
        payment_amount: data.payment_amount?.toString() || '',
        type: data.type || 'event',
        is_recurring: data.is_recurring || false,
        repeat_pattern: data.repeat_pattern,
        repeat_until: data.repeat_until,
        reminder_at: data.reminder_at,
        email_reminder_enabled: data.email_reminder_enabled || false
      };

      console.log('[PublicCalendarEvents] 📋 Formatted update data:', eventData);
      
      const { data: result, error } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: eventData,
          p_additional_persons: [],
          p_user_id: boardUserId,
          p_event_id: data.id,
          p_created_by_type: 'sub_user', // Keep original creator type
          p_created_by_name: externalUserName, // Keep original creator name  
          p_last_edited_by_type: 'sub_user',
          p_last_edited_by_name: externalUserName
        });

      if (error) {
        console.error('[PublicCalendarEvents] ❌ Update RPC error:', error);
        throw error;
      }
      
      console.log('[PublicCalendarEvents] ✅ Event updated with ID:', result);
      
      if (!result) {
        throw new Error('No event ID returned from update RPC call');
      }
      
      // CRITICAL FIX: Fetch the complete event data after update
      const { data: completeEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', result)
        .single();
        
      if (fetchError) {
        console.error('[PublicCalendarEvents] ❌ Error fetching updated event:', fetchError);
        throw fetchError;
      }
      
      console.log('[PublicCalendarEvents] ✅ Fetched complete updated event data:', completeEvent);
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      
      return completeEvent as CalendarEventType;
    } catch (error: any) {
      console.error('[PublicCalendarEvents] ❌ Failed to update event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Delete event function
  const deleteEvent = async ({ id: eventId, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }): Promise<{ success: boolean; }> => {
    try {
      console.log('[PublicCalendarEvents] 🗑️ Deleting event:', eventId, 'choice:', deleteChoice);
      
      const { data: result, error } = await supabase
        .rpc('delete_recurring_series', {
          p_event_id: eventId,
          p_user_id: boardUserId,
          p_delete_choice: deleteChoice || 'this'
        });

      if (error) {
        console.error('[PublicCalendarEvents] ❌ Delete RPC error:', error);
        throw error;
      }
      
      console.log('[PublicCalendarEvents] ✅ Event deleted successfully:', result);
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('[PublicCalendarEvents] ❌ Failed to delete event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    events,
    isLoading,
    error: error as Error | null,
    createEvent,
    updateEvent,
    deleteEvent,
  };
};