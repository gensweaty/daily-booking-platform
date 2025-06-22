
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
      
      const eventData = {
        ...data,
        user_id: userId,
        type: data.type || 'event',
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
      
      const { data: updatedEvent, error } = await supabase
        .from('events')
        .update(updateData)
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
    mutationFn: async (id: string, deleteChoice?: "this" | "series") => {
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
