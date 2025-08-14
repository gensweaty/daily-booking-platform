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

  // Create event function
  const createEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      console.log('Creating event with sub-user metadata:', data);
      
      const { data: result, error } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: {
            ...data,
            created_by_type: 'sub_user',
            created_by_name: externalUserName,
            last_edited_by_type: 'sub_user',
            last_edited_by_name: externalUserName
          },
          p_additional_persons: [],
          p_user_id: boardUserId
        });

      if (error) throw error;
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      
      return result;
    } catch (error: any) {
      console.error('Failed to create event:', error);
      throw error;
    }
  };

  // Update event function
  const updateEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      console.log('Updating event with sub-user metadata:', data);
      
      const { data: result, error } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: {
            ...data,
            last_edited_by_type: 'sub_user',
            last_edited_by_name: externalUserName
          },
          p_additional_persons: [],
          p_user_id: boardUserId,
          p_event_id: data.id
        });

      if (error) throw error;
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      
      return result;
    } catch (error: any) {
      console.error('Failed to update event:', error);
      throw error;
    }
  };

  // Delete event function
  const deleteEvent = async ({ id: eventId, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }): Promise<{ success: boolean; }> => {
    try {
      console.log('Deleting event:', eventId);
      
      const { data: result, error } = await supabase
        .rpc('delete_recurring_series', {
          p_event_id: eventId,
          p_user_id: boardUserId,
          p_delete_choice: deleteChoice || 'this'
        });

      if (error) throw error;
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
      
      return { success: true };
    } catch (error: any) {
      console.error('Failed to delete event:', error);
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