import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export const useCalendarEvents = (businessId?: string, businessUserId?: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const getEvents = async () => {
    if (!user) return [];
    
    console.log("Fetching user events for user:", user.id);
    
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
  };

  const getBusinessEvents = async () => {
    if (businessUserId) {
      console.log("Fetching business events directly using businessUserId:", businessUserId);
      
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
    }
    
    if (businessId) {
      try {
        console.log("Fetching business events for business ID:", businessId);
        
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
        
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessProfile.user_id)
          .order('start_date', { ascending: true });

        if (error) {
          console.error("Error fetching business events:", error);
          throw error;
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

  const getApprovedBookings = async () => {
    if (!user && !businessId) return [];

    try {
      let businessProfileId = businessId;
      
      if (!businessId && user) {
        const { data: userBusinessProfile } = await supabase
          .from("business_profiles")
          .select("id")
          .eq("user_id", user.id)
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
        throw error;
      }
      
      console.log("Fetched approved bookings:", data?.length || 0);
      
      const bookingEvents = (data || []).map(booking => ({
        id: booking.id,
        title: booking.title,
        start_date: booking.start_date,
        end_date: booking.end_date,
        type: 'booking_request',
        created_at: booking.created_at,
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

  const { data: events = [], isLoading: isLoadingUserEvents, error: userEventsError } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: !!user && !businessId,
    staleTime: 1000 * 60,
    refetchInterval: 2000,
  });

  const { data: businessEvents = [], isLoading: isLoadingBusinessEvents, error: businessEventsError } = useQuery({
    queryKey: ['business-events', businessId, businessUserId],
    queryFn: getBusinessEvents,
    enabled: !!businessId || !!businessUserId,
    staleTime: 1000 * 60,
    refetchInterval: 2000,
  });

  const { data: approvedBookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ['approved-bookings', user?.id, businessId],
    queryFn: getApprovedBookings,
    enabled: !!businessId || !!user,
    staleTime: 1000 * 60,
    refetchInterval: 2000,
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
    },
  });

  const allEvents = businessId 
    ? [...businessEvents, ...approvedBookings]
    : [...events, ...approvedBookings];

  console.log("useCalendarEvents combined data:", {
    userEvents: events.length,
    businessEvents: businessEvents.length,
    approvedBookings: approvedBookings.length,
    combined: allEvents.length,
    isExternalCalendar: !!businessId,
    businessUserId
  });

  return {
    events: allEvents,
    isLoading: businessId ? (isLoadingBusinessEvents || isLoadingBookings) : (isLoadingUserEvents || isLoadingBookings),
    error: businessId ? businessEventsError : userEventsError,
    createEvent: createEventMutation?.mutateAsync,
    updateEvent: updateEventMutation?.mutateAsync,
    deleteEvent: deleteEventMutation?.mutateAsync,
  };
};
