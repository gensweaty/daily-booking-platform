
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { generateRecurringInstances, isVirtualInstance, getParentEventId } from "@/lib/recurringEvents";

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: businessId ? ['business-events', businessId] : ['events', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*')
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (businessId && businessUserId) {
        query = query.eq('user_id', businessUserId);
      } else if (user?.id) {
        query = query.eq('user_id', user.id);
      } else {
        return [];
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }

      if (!data) return [];

      // Generate recurring instances for all events
      const allEvents: CalendarEventType[] = [];
      
      data.forEach(event => {
        const instances = generateRecurringInstances(event);
        allEvents.push(...instances);
      });

      console.log(`Loaded ${data.length} base events, generated ${allEvents.length} total instances`);
      return allEvents;
    },
    enabled: !!user || (!!businessId && !!businessUserId),
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: Partial<CalendarEventType>) => {
      if (!user && !businessUserId) throw new Error("User not authenticated");
      
      const userId = businessUserId || user!.id;
      
      console.log("Creating event with data:", data);
      
      // Ensure required fields are present
      if (!data.start_date || !data.end_date) {
        throw new Error("Start date and end date are required");
      }
      
      // Clean the data to match database schema
      const eventData = {
        user_id: userId,
        title: data.title || data.user_surname || '',
        user_surname: data.user_surname,
        user_number: data.user_number,
        social_network_link: data.social_network_link,
        event_notes: data.event_notes,
        start_date: data.start_date,
        end_date: data.end_date,
        type: data.type || 'event',
        payment_status: data.payment_status,
        payment_amount: data.payment_amount,
        language: data.language,
        customer_id: data.customer_id,
        event_name: data.event_name,
        // Recurring event fields
        is_recurring: data.is_recurring || false,
        repeat_pattern: data.repeat_pattern,
        repeat_until: data.repeat_until,
        parent_event_id: data.parent_event_id,
      };

      const { data: newEvent, error } = await supabase
        .from('events')
        .insert(eventData)
        .select()
        .single();

      if (error) {
        console.error('Error creating event:', error);
        throw error;
      }

      console.log("Event created successfully:", newEvent);
      return newEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: businessId ? ['business-events', businessId] : ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => {
      console.error('Create event error:', error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: Partial<CalendarEventType>) => {
      if (!data.id) throw new Error("Event ID is required for update");
      
      console.log("Updating event with data:", data);
      
      // Handle virtual instance updates
      if (isVirtualInstance(data.id)) {
        // This should create a new standalone event instead of updating
        const { id, ...eventDataWithoutId } = data;
        return createEventMutation.mutateAsync(eventDataWithoutId);
      }
      
      const { id, ...updateData } = data;
      
      // Clean the update data to match database schema
      const cleanUpdateData = {
        title: updateData.title,
        user_surname: updateData.user_surname,
        user_number: updateData.user_number,
        social_network_link: updateData.social_network_link,
        event_notes: updateData.event_notes,
        start_date: updateData.start_date,
        end_date: updateData.end_date,
        type: updateData.type,
        payment_status: updateData.payment_status,
        payment_amount: updateData.payment_amount,
        language: updateData.language,
        customer_id: updateData.customer_id,
        event_name: updateData.event_name,
        // Recurring event fields
        is_recurring: updateData.is_recurring,
        repeat_pattern: updateData.repeat_pattern,
        repeat_until: updateData.repeat_until,
        parent_event_id: updateData.parent_event_id,
      };
      
      const { data: updatedEvent, error } = await supabase
        .from('events')
        .update(cleanUpdateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating event:', error);
        throw error;
      }

      console.log("Event updated successfully:", updatedEvent);
      return updatedEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: businessId ? ['business-events', businessId] : ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => {
      console.error('Update event error:', error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
      console.log("Deleting event:", id, "choice:", deleteChoice);
      
      // Handle virtual instance deletion
      if (isVirtualInstance(id)) {
        if (deleteChoice === "this") {
          // For virtual instances, we don't actually delete from database
          // Instead, we could create an exception record or handle it in the frontend
          console.log("Deleting single instance of recurring event:", id);
          // For now, just return success - in a full implementation, 
          // you might want to store deletion exceptions
          return { success: true };
        } else if (deleteChoice === "series") {
          // Delete the parent event
          const parentId = getParentEventId(id);
          const { error } = await supabase
            .from('events')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', parentId);
            
          if (error) {
            console.error('Error deleting parent event:', error);
            throw error;
          }
          
          return { success: true };
        }
      }
      
      // Regular event deletion
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Error deleting event:', error);
        throw error;
      }

      console.log("Event deleted successfully:", id);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: businessId ? ['business-events', businessId] : ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "events.eventDeleted"
        }
      });
    },
    onError: (error: any) => {
      console.error('Delete event error:', error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
    },
  });

  return {
    events: eventsQuery.data || [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};
