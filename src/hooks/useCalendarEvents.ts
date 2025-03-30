
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
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      if (error) {
        console.error("Error fetching user events:", error);
        throw error;
      }
      
      console.log("Fetched user events:", data?.length || 0);
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
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessUserId)
          .order('start_date', { ascending: true });

        if (error) {
          console.error("Error fetching business events with businessUserId:", error);
          return [];
        }
        
        console.log("Fetched business events with businessUserId:", data?.length || 0, data);
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
        
        console.log("Found user_id for business:", businessProfile.user_id);
        
        // Then get all events for this user
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessProfile.user_id)
          .order('start_date', { ascending: true });

        if (error) {
          console.error("Error fetching business events:", error);
          return [];
        }
        
        console.log("Fetched business events:", data?.length || 0, data);
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
      
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessProfileId)
        .eq('status', 'approved');
        
      if (error) {
        console.error("Error fetching approved bookings:", error);
        return [];
      }
      
      console.log("Fetched approved bookings:", data?.length || 0);
      
      // Convert booking requests to calendar events
      const bookingEvents = (data || []).map(booking => ({
        id: booking.id,
        title: booking.title,
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
    
    const { data, error } = await supabase
      .from('events')
      .insert([{ ...event, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    
    toast({
      title: "Event created",
      description: "Your event has been added to the calendar."
    });
    
    return data;
  };

  // Mutation function to update an existing event
  const updateEvent = async ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    
    toast({
      title: "Event updated",
      description: "Your event has been updated successfully."
    });
    
    return data;
  };

  // Mutation function to delete an event
  const deleteEvent = async (id: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    
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
    refetchInterval: 2000,
  });

  // Business events query
  const { data: businessEvents = [], isLoading: isLoadingBusinessEvents, error: businessEventsError } = useQuery({
    queryKey: ['business-events', businessId, businessUserId],
    queryFn: getBusinessEvents,
    enabled: !!businessId || !!businessUserId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 2000,
  });

  // Approved bookings query
  const { data: approvedBookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ['approved-bookings', user?.id, businessId, businessUserId],
    queryFn: getApprovedBookings,
    enabled: !!businessId || !!businessUserId || !!user,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 2000,
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

  // Combine events based on whether viewing business events or own events
  const allEvents = (businessId || businessUserId) 
    ? [...businessEvents, ...approvedBookings]
    : [...events, ...approvedBookings];

  console.log("useCalendarEvents combined data:", {
    userEvents: events.length,
    businessEvents: businessEvents.length,
    approvedBookings: approvedBookings.length,
    combined: allEvents.length,
    isExternalCalendar: !!(businessId || businessUserId),
    businessUserId
  });

  return {
    events: allEvents,
    isLoading: (businessId || businessUserId) ? (isLoadingBusinessEvents || isLoadingBookings) : (isLoadingUserEvents || isLoadingBookings),
    error: (businessId || businessUserId) ? businessEventsError : userEventsError,
    createEvent: createEventMutation?.mutateAsync,
    updateEvent: updateEventMutation?.mutateAsync,
    deleteEvent: deleteEventMutation?.mutateAsync,
  };
};
