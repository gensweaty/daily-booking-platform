
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

  // Improved function to check time slot availability with proper conflict detection
  const checkTimeSlotAvailability = async (
    startDateTime: string,
    endDateTime: string,
    eventId?: string
  ): Promise<{ available: boolean; conflictingEvent?: any }> => {
    try {
      const startISO = new Date(startDateTime).toISOString();
      const endISO = new Date(endDateTime).toISOString();
      
      console.log("Checking time slot availability:", { 
        startDateTime, 
        endDateTime, 
        eventId,
        start: startISO,
        end: endISO
      });
      
      // If we're editing an approved booking event, skip the conflict check
      if (eventId) {
        // Check if this is an approved booking event
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("type, status, booking_request_id")
          .eq("id", eventId)
          .single();
          
        if (!eventError && eventData) {
          console.log("Event data for conflict check:", eventData);
          
          // Skip conflict check for approved booking events
          if (eventData.type === 'booking_request' || eventData.booking_request_id) {
            console.log("Skipping conflict check for booking event:", eventId);
            return { available: true };
          }
        }
      }
      
      // Query for events that would overlap with the requested time slot
      const eventQuery = supabase
        .from("events")
        .select("*")
        .is("deleted_at", null)
        // Proper overlap check: Event starts before new event ends AND event ends after new event starts
        .lt("start_date", endISO)
        .gt("end_date", startISO);
      
      // If we're updating an existing event, exclude it from the conflict check
      let filteredQuery = eventQuery;
      if (eventId) {
        filteredQuery = eventQuery.neq("id", eventId);
      }
      
      const { data: conflictingEvents, error: eventsError } = await filteredQuery;
      
      if (eventsError) {
        console.error("Error checking events for conflicts:", eventsError);
        return { available: false };
      }
      
      if (conflictingEvents && conflictingEvents.length > 0) {
        console.log("Conflict found with event:", conflictingEvents[0]);
        return { available: false, conflictingEvent: conflictingEvents[0] };
      }
      
      // Also check approved booking requests for conflicts
      let bookingQuery = supabase
        .from("booking_requests")
        .select("*")
        .eq("status", "approved")
        .lt("start_date", endISO)
        .gt("end_date", startISO);
      
      // Skip checking against the booking request if we're editing an event that was created from it
      if (eventId) {
        // First check if this event has a booking_request_id
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("booking_request_id")
          .eq("id", eventId)
          .single();
          
        if (!eventError && eventData && eventData.booking_request_id) {
          console.log("Excluding booking request from conflict check:", eventData.booking_request_id);
          bookingQuery = bookingQuery.neq("id", eventData.booking_request_id);
        }
      }
      
      const { data: conflictingBookings, error: bookingsError } = await bookingQuery;
      
      if (bookingsError) {
        console.error("Error checking bookings for conflicts:", bookingsError);
        return { available: false };
      }
      
      if (conflictingBookings && conflictingBookings.length > 0) {
        console.log("Conflict found with booking request:", conflictingBookings[0]);
        return { available: false, conflictingEvent: conflictingBookings[0] };
      }
      
      console.log("Time slot is available - no conflicts found");
      return { available: true };
    } catch (error) {
      console.error("Error in checkTimeSlotAvailability:", error);
      return { available: false };
    }
  };

  // Create a new event
  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user) throw new Error("User not authenticated");

      // Check time slot availability for new events
      const { available, conflictingEvent } = await checkTimeSlotAvailability(
        eventData.start_date!,
        eventData.end_date!
      );

      if (!available) {
        const conflictTitle = conflictingEvent?.title || 'another event';
        throw new Error(`Time slot conflicts with "${conflictTitle}"`);
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
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    }
  });

  // Update an existing event
  const updateEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user) throw new Error("User not authenticated");
      if (!eventData.id) throw new Error("Event ID is required");

      // Check time slot availability for the update, excluding the current event
      const { available, conflictingEvent } = await checkTimeSlotAvailability(
        eventData.start_date!,
        eventData.end_date!,
        eventData.id
      );

      if (!available) {
        const conflictTitle = conflictingEvent?.title || 'another event';
        throw new Error(`Time slot conflicts with "${conflictTitle}"`);
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
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    }
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
      console.error("Error in handleSubmitEvent:", error);
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
