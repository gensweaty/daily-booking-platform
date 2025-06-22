import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { generateRecurringInstances, isVirtualInstance, getParentEventId, filterDeletedInstances } from "@/lib/recurringEvents";

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

      // Separate regular events from deletion exceptions
      const regularEvents = data.filter(event => event.type !== 'deleted_exception');
      const deletionExceptions = data.filter(event => event.type === 'deleted_exception');
      
      const allEvents: CalendarEventType[] = [];
      
      regularEvents.forEach(event => {
        const instances = generateRecurringInstances(event);
        // Filter out instances that have deletion exceptions
        const filteredInstances = filterDeletedInstances(instances, deletionExceptions);
        allEvents.push(...filteredInstances);
      });

      console.log(`Loaded ${regularEvents.length} base events, generated ${allEvents.length} total instances after filtering exceptions`);
      return allEvents;
    },
    enabled: !!user || (!!businessId && !!businessUserId),
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: Partial<CalendarEventType>) => {
      if (!user && !businessUserId) throw new Error("User not authenticated");
      
      const userId = businessUserId || user!.id;
      
      console.log("Creating event with data:", data);
      
      if (!data.start_date || !data.end_date) {
        throw new Error("Start date and end date are required");
      }
      
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
      
      if (isVirtualInstance(data.id)) {
        const { id, ...eventDataWithoutId } = data;
        return createEventMutation.mutateAsync(eventDataWithoutId);
      }
      
      const { id, ...updateData } = data;
      
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
      
      // Handle virtual instances (non-first events in recurring series)
      if (isVirtualInstance(id)) {
        const parentId = getParentEventId(id);
        const instanceDate = id.split("-").slice(-3).join("-"); // Extract date from virtual ID
        
        if (deleteChoice === "this") {
          console.log("Creating exception for virtual instance:", id, "on date:", instanceDate);
          
          // Create an exception event that marks this specific date as deleted
          const exceptionData = {
            user_id: businessUserId || user!.id,
            title: `DELETED_EXCEPTION_${instanceDate}`,
            start_date: instanceDate + 'T00:00:00.000Z',
            end_date: instanceDate + 'T23:59:59.999Z',
            type: 'deleted_exception',
            parent_event_id: parentId,
            event_notes: `Exception for recurring event on ${instanceDate}`,
            is_recurring: false
          };
          
          const { error } = await supabase
            .from('events')
            .insert(exceptionData);
            
          if (error) {
            console.error('Error creating deletion exception:', error);
            throw error;
          }
          
          console.log("Created deletion exception for:", instanceDate);
          return { success: true, deletedInstanceId: id, isVirtualDelete: true };
        } else if (deleteChoice === "series") {
          // Delete the parent event to remove entire series
          console.log("Deleting parent event for series:", parentId);
          
          const { error } = await supabase
            .from('events')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', parentId);
            
          if (error) {
            console.error('Error deleting parent event:', error);
            throw error;
          }
          
          return { success: true, deletedParentId: parentId };
        }
      }
      
      // Handle regular events and first events in recurring series
      if (deleteChoice === "this" && !isVirtualInstance(id)) {
        // Check if this is the first event of a recurring series
        const { data: eventData, error: fetchError } = await supabase
          .from('events')
          .select('is_recurring, repeat_pattern, start_date')
          .eq('id', id)
          .single();
          
        if (fetchError) {
          console.error('Error fetching event data:', fetchError);
          throw fetchError;
        }
        
        if (eventData && eventData.is_recurring) {
          // This is the first event in a recurring series
          console.log("Deleting first instance of recurring series");
          
          // Create an exception for the first occurrence and keep the series
          const firstDate = new Date(eventData.start_date).toISOString().split('T')[0];
          const exceptionData = {
            user_id: businessUserId || user!.id,
            title: `DELETED_EXCEPTION_${firstDate}`,
            start_date: firstDate + 'T00:00:00.000Z',
            end_date: firstDate + 'T23:59:59.999Z',
            type: 'deleted_exception',
            parent_event_id: id,
            event_notes: `Exception for recurring event on ${firstDate}`,
            is_recurring: false
          };
          
          const { error: exceptionError } = await supabase
            .from('events')
            .insert(exceptionData);
            
          if (exceptionError) {
            console.error('Error creating first instance exception:', exceptionError);
            throw exceptionError;
          }
          
          return { success: true, deletedFirstInstance: id, isFirstInstanceDelete: true };
        }
      }
      
      // For regular events or when deleting entire series
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Error deleting event:', error);
        throw error;
      }

      console.log("Event deleted successfully:", id);
      return { success: true, deletedEventId: id };
    },
    onSuccess: () => {
      // Simply invalidate queries and let them refetch
      // The exception events will prevent deleted instances from being generated
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
