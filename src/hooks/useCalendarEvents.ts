import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export const useCalendarEvents = (businessId?: string, businessUserId?: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // Function to fetch user's own events
  const getEvents = async () => {
    if (!user) return [];
    
    console.log("Fetching user events for user:", user.id);
    
    try {
      // CRITICAL SECURITY FIX: Added strict user_id equality check
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id) // This ensures we only get this user's events
        .is('deleted_at', null) // Only fetch non-deleted events
        .order('start_date', { ascending: true });

      if (error) {
        console.error("Error fetching user events:", error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} events for user ${user.id}`);
      
      // CRITICAL SECURITY FIX: Perform client-side validation to ensure data integrity
      if (data && data.length > 0) {
        const validUserEvents = data.filter(event => event.user_id === user.id);
        
        if (validUserEvents.length !== data.length) {
          console.error(`CRITICAL SECURITY BREACH: API returned ${data.length} events but only ${validUserEvents.length} belong to current user ${user.id}!`);
          
          // Log the specific events that don't belong to the user for debugging
          const invalidEvents = data.filter(event => event.user_id !== user.id);
          console.error("Invalid events:", invalidEvents.map(e => ({ id: e.id, user_id: e.user_id, title: e.title })));
          
          // Return only the valid events
          return validUserEvents;
        }
      }
      
      return data || [];
    } catch (err) {
      console.error("Exception in getEvents:", err);
      return [];
    }
  };

  // Function to fetch business events using businessUserId or businessId
  const getBusinessEvents = async () => {
    // If we have businessUserId directly, use it - this is more reliable
    if (businessUserId) {
      console.log("Fetching business events directly using businessUserId:", businessUserId);
      
      try {
        // CRITICAL SECURITY FIX: Added strict user_id equality check
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessUserId) // Ensures we only get that business's events
          .is('deleted_at', null) // Only fetch non-deleted events
          .order('start_date', { ascending: true });

        if (error) {
          console.error("Error fetching business events with businessUserId:", error);
          return [];
        }
        
        console.log(`Fetched ${data?.length || 0} business events for user ${businessUserId}`);
        
        // CRITICAL SECURITY FIX: Perform client-side validation to ensure data integrity
        if (data && data.length > 0) {
          const validBusinessEvents = data.filter(event => event.user_id === businessUserId);
          
          if (validBusinessEvents.length !== data.length) {
            console.error(`CRITICAL SECURITY BREACH: API returned ${data.length} events but only ${validBusinessEvents.length} belong to business user ${businessUserId}!`);
            return validBusinessEvents;
          }
        }
        
        return data || [];
      } catch (error) {
        console.error("Exception in getBusinessEvents with businessUserId:", error);
        return [];
      }
    }
    
    // Fall back to using businessId to look up user_id
    if (businessId) {
      try {
        console.log("Fetching business events for business ID:", businessId);
        
        // First get the user_id associated with this business
        const { data: businessProfile, error: businessError } = await supabase
          .from("business_profiles")
          .select("user_id")
          .eq("id", businessId)
          .single();
          
        if (businessError) {
          console.error("Error fetching business profile:", businessError);
          return [];
        }
        
        if (!businessProfile?.user_id) {
          console.error("No user_id found for business:", businessId);
          return [];
        }
        
        const businessUserIdFromProfile = businessProfile.user_id;
        console.log("Found user_id for business:", businessUserIdFromProfile);
        
        // Then get all events for this user
        // CRITICAL SECURITY FIX: Added strict user_id equality check
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessUserIdFromProfile) // Ensures we only get that business's events
          .is('deleted_at', null) // Only fetch non-deleted events
          .order('start_date', { ascending: true });

        if (error) {
          console.error("Error fetching business events:", error);
          return [];
        }
        
        console.log(`Fetched ${data?.length || 0} business events`);
        
        // CRITICAL SECURITY FIX: Perform client-side validation to ensure data integrity
        if (data && data.length > 0) {
          const validBusinessEvents = data.filter(event => event.user_id === businessUserIdFromProfile);
          
          if (validBusinessEvents.length !== data.length) {
            console.error(`CRITICAL SECURITY BREACH: API returned ${data.length} events but only ${validBusinessEvents.length} belong to business user ${businessUserIdFromProfile}!`);
            return validBusinessEvents;
          }
        }
        
        return data || [];
      } catch (error) {
        console.error("Error fetching business events:", error);
        return [];
      }
    }
    
    return [];
  };

  // Function to fetch approved booking requests
  const getApprovedBookings = async () => {
    if (!user && !businessId && !businessUserId) return [];

    try {
      let businessProfileId = businessId;
      
      // If we have no business ID but we're logged in
      if (!businessProfileId && user) {
        const { data: userBusinessProfile } = await supabase
          .from("business_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
          
        if (userBusinessProfile?.id) {
          businessProfileId = userBusinessProfile.id;
        }
      }
      
      // If we have a business user ID but no business ID
      if (!businessProfileId && businessUserId) {
        const { data: userBusinessProfile } = await supabase
          .from("business_profiles")
          .select("id")
          .eq("user_id", businessUserId)
          .maybeSingle();
          
        if (userBusinessProfile?.id) {
          businessProfileId = userBusinessProfile.id;
        }
      }
      
      if (!businessProfileId) {
        console.log("No business profile ID found for fetching bookings");
        return [];
      }
      
      console.log("Fetching approved bookings for business ID:", businessProfileId);
      
      // FIXED: Added proper filters for bookings
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessProfileId)
        .eq('status', 'approved');
        
      if (error) {
        console.error("Error fetching approved bookings:", error);
        return [];
      }
      
      console.log(`Fetched ${data?.length || 0} approved bookings`);
      
      // Convert booking requests to calendar events
      const bookingEvents = (data || []).map(booking => ({
        id: booking.id,
        title: booking.title || 'Booking',
        start_date: booking.start_date,
        end_date: booking.end_date,
        type: 'booking_request',
        created_at: booking.created_at || new Date().toISOString(),
        user_id: booking.user_id || '',
        requester_name: booking.requester_name,
        requester_email: booking.requester_email,
      }));
      
      return bookingEvents;
    } catch (error) {
      console.error("Error fetching approved bookings:", error);
      return [];
    }
  };

  // Mutation function to create a new event
  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to create events");
    
    // CRITICAL SECURITY FIX: Force the user_id to be the current user's ID
    const eventWithUserId = { ...event, user_id: user.id };
    console.log(`Creating event with explicit user_id: ${user.id}`);
    
    const { data, error } = await supabase
      .from('events')
      .insert([eventWithUserId])
      .select()
      .single();

    if (error) {
      console.error("Error creating event:", error);
      throw error;
    }
    
    // CRITICAL SECURITY FIX: Verify the created event has the correct user_id
    if (data.user_id !== user.id) {
      console.error(`CRITICAL SECURITY BREACH: Created event has user_id ${data.user_id} instead of ${user.id}`);
      throw new Error("Security error: Event was created with incorrect user ID");
    }
    
    toast({
      title: "Event created",
      description: "Your event has been added to the calendar."
    });
    
    return data;
  };

  // Mutation function to update an existing event
  const updateEvent = async ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    
    // CRITICAL SECURITY FIX: Never allow changing user_id when updating
    const safeUpdates = { ...updates };
    if ('user_id' in safeUpdates) {
      delete safeUpdates.user_id;
      console.warn("SECURITY: Prevented attempt to change user_id during event update");
    }
    
    console.log(`Updating event ${id} for user ${user.id}`);
    
    // CRITICAL SECURITY FIX: First verify the event belongs to this user
    const { data: existingEvent, error: getError } = await supabase
      .from('events')
      .select('user_id')
      .eq('id', id)
      .single();
      
    if (getError) {
      console.error("Error fetching event for update:", getError);
      throw getError;
    }
    
    if (!existingEvent) {
      throw new Error("Event not found");
    }
    
    if (existingEvent.user_id !== user.id) {
      console.error(`SECURITY BREACH ATTEMPT: User ${user.id} attempted to update event ${id} belonging to user ${existingEvent.user_id}`);
      throw new Error("You do not have permission to update this event");
    }
    
    // CRITICAL SECURITY FIX: Added user_id check to ensure users can only update their own events
    const { data, error } = await supabase
      .from('events')
      .update(safeUpdates)
      .eq('id', id)
      .eq('user_id', user.id) // Critical: Only update events owned by this user
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      throw error;
    }
    
    toast({
      title: "Event updated",
      description: "Your event has been updated successfully."
    });
    
    return data;
  };

  // Mutation function to delete an event
  const deleteEvent = async (id: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    console.log(`Deleting event ${id} for user ${user.id}`);
    
    // CRITICAL SECURITY FIX: First verify the event belongs to this user
    const { data: existingEvent, error: getError } = await supabase
      .from('events')
      .select('user_id')
      .eq('id', id)
      .single();
      
    if (getError) {
      console.error("Error fetching event for delete:", getError);
      throw getError;
    }
    
    if (!existingEvent) {
      throw new Error("Event not found");
    }
    
    if (existingEvent.user_id !== user.id) {
      console.error(`SECURITY BREACH ATTEMPT: User ${user.id} attempted to delete event ${id} belonging to user ${existingEvent.user_id}`);
      throw new Error("You do not have permission to delete this event");
    }
    
    // CRITICAL SECURITY FIX: Added user_id check to ensure users can only delete their own events
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Critical: Only delete events owned by this user

    if (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
    
    toast({
      title: "Event deleted",
      description: "Your event has been removed from the calendar."
    });
  };

  // User's own events query
  const { data: events = [], isLoading: isLoadingUserEvents, error: userEventsError } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: !!user && !businessId && !businessUserId,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Business events query
  const { data: businessEvents = [], isLoading: isLoadingBusinessEvents, error: businessEventsError } = useQuery({
    queryKey: ['business-events', businessId, businessUserId],
    queryFn: getBusinessEvents,
    enabled: !!businessId || !!businessUserId,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Approved bookings query
  const { data: approvedBookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ['approved-bookings', user?.id, businessId, businessUserId],
    queryFn: getApprovedBookings,
    enabled: !!businessId || !!businessUserId || !!user,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
    },
  });

  // CRITICAL SECURITY FIX: Enhanced verification for events ownership
  const allEvents = (() => {
    // Determine which events to use (user's or business's)
    const currentUserEvents = (businessId || businessUserId) ? businessEvents : events;
    
    // Check if business or user mode
    const targetUserId = businessUserId || (businessId ? null : user?.id);
    
    // Apply strict filtering on all events to ensure proper data isolation
    const safeEvents = targetUserId 
      ? currentUserEvents.filter(event => {
          if (event.user_id !== targetUserId) {
            console.error(`SECURITY BREACH: Found event (id: ${event.id}, title: ${event.title}) belonging to user ${event.user_id} that should not be visible to user ${targetUserId}`);
            return false;
          }
          return true;
        }) 
      : currentUserEvents;
    
    if (safeEvents.length !== currentUserEvents.length) {
      console.error(`CRITICAL SECURITY: Filtered out ${currentUserEvents.length - safeEvents.length} events due to user_id mismatch`);
    }
    
    // Return filtered events plus approved bookings
    return [...safeEvents, ...approvedBookings];
  })();

  // Log counts for debugging
  console.log("useCalendarEvents summary:", {
    userEvents: events.length,
    businessEvents: businessEvents.length,
    approvedBookings: approvedBookings.length,
    combinedTotal: allEvents.length,
    userId: user?.id,
    businessId,
    businessUserId
  });

  return {
    events: allEvents,
    isLoading: (businessId || businessUserId) ? (isLoadingBusinessEvents || isLoadingBookings) : (isLoadingUserEvents || isLoadingBookings),
    error: (businessId || businessUserId) ? businessEventsError : userEventsError,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};
