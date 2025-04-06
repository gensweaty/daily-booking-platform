
// This file is being created/modified to fix the time slot conflict issue
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export const useCalendarEvents = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch events for the authenticated user
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("start_date", { ascending: true });

      if (error) {
        console.error("Error fetching events:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!user,
  });

  // Fixed function to check time slot availability - now properly excludes the current event
  const checkTimeSlotAvailability = async (
    startDateTime: string,
    endDateTime: string,
    eventId?: string
  ): Promise<boolean> => {
    try {
      console.log("Checking time slot availability:", { 
        startDateTime, 
        endDateTime, 
        eventId,
        start: new Date(startDateTime).toISOString(),
        end: new Date(endDateTime).toISOString()
      });
      
      // Skip check for approved booking events
      if (eventId) {
        // Check if this is an approved booking event
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("type, status")
          .eq("id", eventId)
          .single();
          
        if (!eventError && eventData && eventData.type === 'booking_request' && eventData.status === 'approved') {
          console.log("Skipping conflict check for approved booking event:", eventId);
          return true;
        }
      }
      
      // Build the query with explicit exclusion of the current event
      let query = supabase
        .from("events")
        .select("*")
        .is("deleted_at", null);
      
      // We need to add the time filter using .or() to check for overlaps
      query = query.or(`start_date.lt.${new Date(endDateTime).toISOString()},end_date.gt.${new Date(startDateTime).toISOString()}`);
      
      // If we're updating an existing event, exclude it from the conflict check
      if (eventId) {
        query = query.neq("id", eventId);
      }
      
      // Execute the query
      const { data: existingEvents, error } = await query;

      if (error) {
        console.error("Error checking time slot availability:", error);
        return false;
      }

      console.log(`Found ${existingEvents?.length || 0} potential conflicts`);
      
      // If there are no events at all or no events in the timeframe, the slot is available
      if (!existingEvents || existingEvents.length === 0) return true;
      
      // Check if any of the events actually conflict with the requested time slot
      const conflicts = existingEvents.filter(event => {
        const eventStart = new Date(event.start_date);
        const eventEnd = new Date(event.end_date);
        const requiredStart = new Date(startDateTime);
        const requiredEnd = new Date(endDateTime);
        
        // Check for overlap - the standard algorithm
        const hasOverlap = requiredStart < eventEnd && requiredEnd > eventStart;
        
        if (hasOverlap) {
          console.log("Conflict detected with event:", {
            id: event.id,
            title: event.title,
            start: event.start_date,
            end: event.end_date,
            requestedStart: startDateTime,
            requestedEnd: endDateTime
          });
        }
        
        return hasOverlap;
      });
      
      return conflicts.length === 0;
    } catch (error) {
      console.error("Error in checkTimeSlotAvailability:", error);
      return false;
    }
  };

  // Create a new event
  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user) throw new Error("User not authenticated");

      // First check time slot availability - but only for new events (no ID)
      // For updates, this check is done separately in updateEventMutation
      if (!eventData.id) {
        const isAvailable = await checkTimeSlotAvailability(
          eventData.start_date!,
          eventData.end_date!
        );

        if (!isAvailable) {
          throw new Error("Time slot is not available");
        }
      }

      const newEvent = {
        ...eventData,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from("events")
        .insert([newEvent])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  // Update an existing event
  const updateEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user) throw new Error("User not authenticated");
      if (!eventData.id) throw new Error("Event ID is required");

      // Special handling for approved booking events
      if (eventData.type === 'booking_request' && eventData.status === 'approved') {
        console.log("Skipping time slot check for approved booking event");
        
        const { data, error } = await supabase
          .from("events")
          .update(eventData)
          .eq("id", eventData.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      // Check time slot availability for the update, excluding the current event
      const isAvailable = await checkTimeSlotAvailability(
        eventData.start_date!,
        eventData.end_date!,
        eventData.id
      );

      if (!isAvailable) {
        throw new Error("Time slot is not available");
      }

      const { data, error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", eventData.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  // Submit handler for both create and update
  const handleSubmitEvent = async (
    eventData: Partial<CalendarEventType>
  ): Promise<CalendarEventType> => {
    try {
      if (eventData.id) {
        // Update existing event
        return await updateEventMutation.mutateAsync(eventData);
      } else {
        // Create new event
        return await createEventMutation.mutateAsync(eventData);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Delete an event
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("User not authenticated");

      // Soft delete by setting deleted_at
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Success",
        description: "Event has been deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  // Dialog open/close handlers
  const openDialog = (event?: CalendarEventType, date?: Date) => {
    setSelectedEvent(event || null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedEvent(null);
  };

  return {
    events,
    isLoading,
    selectedEvent,
    isDialogOpen,
    openDialog,
    closeDialog,
    handleSubmitEvent,
    deleteEvent: deleteEventMutation.mutateAsync,
    checkTimeSlotAvailability,
  };
};
