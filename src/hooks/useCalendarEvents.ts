
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

      // Make sure all events have the required fields
      return (data || []).map(event => ({
        ...event,
        deleted_at: event.deleted_at // Ensure deleted_at is passed through
      }));
    },
    enabled: !!user,
  });

  // IMPROVED: More robust time slot availability checking function
  const checkTimeSlotAvailability = async (
    startDateTime: string,
    endDateTime: string,
    eventId?: string
  ): Promise<{ available: boolean; conflictingEvent?: any }> => {
    try {
      // Make sure we have valid date objects
      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error("Invalid dates provided:", { startDateTime, endDateTime });
        return { available: false };
      }
      
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();
      
      console.log("Checking time slot availability:", { 
        startDateTime, 
        endDateTime, 
        eventId,
        startISO,
        endISO
      });
      
      // Query for events that would overlap with the requested time slot
      // IMPROVED: More accurate filtering for overlapping events
      let eventQuery = supabase
        .from("events")
        .select("*")
        .is("deleted_at", null)
        .filter('start_date', 'lt', endISO) // Event starts before new event ends 
        .filter('end_date', 'gt', startISO); // Event ends after new event starts
      
      // If we're updating an existing event, exclude it from the conflict check
      if (eventId) {
        eventQuery = eventQuery.neq("id", eventId);
      }
      
      const { data: conflictingEvents, error: eventsError } = await eventQuery;
      
      if (eventsError) {
        console.error("Error checking events for conflicts:", eventsError);
        return { available: false };
      }
      
      if (conflictingEvents && conflictingEvents.length > 0) {
        console.log("Conflict found with event:", conflictingEvents[0]);
        return { available: false, conflictingEvent: conflictingEvents[0] };
      }
      
      // Also check approved booking requests for conflicts
      // IMPROVED: More accurate filtering for overlapping bookings
      let bookingQuery = supabase
        .from("booking_requests")
        .select("*")
        .eq("status", "approved")
        .filter('start_date', 'lt', endISO) // Booking starts before new event ends
        .filter('end_date', 'gt', startISO); // Booking ends after new event starts
      
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

      // Step 1: Create the event
      const { data, error } = await supabase
        .from("events")
        .insert([newEvent])
        .select()
        .single();

      if (error) throw error;
      
      // Step 2: Create a customer record in CRM for this event
      try {
        await supabase
          .from("customers")
          .insert([{
            title: eventData.title,
            user_surname: eventData.user_surname || '',
            user_number: eventData.user_number || '',
            social_network_link: eventData.social_network_link || '',
            event_notes: eventData.event_notes || '',
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            payment_status: eventData.payment_status || 'not_paid',
            payment_amount: eventData.payment_amount || null,
            user_id: user.id,
            type: eventData.type || 'event'
          }]);
          
        console.log("Created customer record for event:", data.id);
      } catch (crmError) {
        console.error("Error creating customer record for event:", crmError);
        // Don't block event creation if customer creation fails
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
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

      // Step 1: Update the event
      const { data, error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", eventData.id)
        .select()
        .single();

      if (error) throw error;
      
      // Step 2: Find and update corresponding customer in CRM
      try {
        // Find customers with same title and dates
        const { data: existingCustomers } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", user.id)
          .eq("title", data.title)
          .eq("start_date", data.start_date)
          .eq("end_date", data.end_date);
          
        if (existingCustomers && existingCustomers.length > 0) {
          // Update the existing customer
          await supabase
            .from("customers")
            .update({
              title: eventData.title,
              user_surname: eventData.user_surname || '',
              user_number: eventData.user_number || '',
              social_network_link: eventData.social_network_link || '',
              event_notes: eventData.event_notes || '',
              start_date: eventData.start_date,
              end_date: eventData.end_date,
              payment_status: eventData.payment_status || 'not_paid',
              payment_amount: eventData.payment_amount || null
            })
            .eq("id", existingCustomers[0].id);
            
          console.log("Updated customer record for event:", data.id);
        } else {
          // Create a new customer if none exists
          await supabase
            .from("customers")
            .insert([{
              title: eventData.title,
              user_surname: eventData.user_surname || '',
              user_number: eventData.user_number || '',
              social_network_link: eventData.social_network_link || '',
              event_notes: eventData.event_notes || '',
              start_date: eventData.start_date,
              end_date: eventData.end_date,
              payment_status: eventData.payment_status || 'not_paid',
              payment_amount: eventData.payment_amount || null,
              user_id: user.id,
              type: eventData.type || 'event'
            }]);
            
          console.log("Created customer record for updated event:", data.id);
        }
      } catch (crmError) {
        console.error("Error updating customer record for event:", crmError);
        // Don't block event update if customer update fails
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
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
