
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export const useCalendarEvents = (businessId?: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const getEvents = async () => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true });

    if (error) {
      console.error("Error fetching user events:", error);
      return [];
    }
    console.log(`Fetched ${data?.length || 0} events for user ${user.id}`);
    return data || [];
  };

  const getBusinessEvents = async () => {
    if (!businessId) return [];
    
    try {
      // First, get the user ID associated with this business
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
        console.error("Business has no associated user_id");
        return [];
      }

      console.log(`Fetching events for business user ID: ${businessProfile.user_id}`);
      
      // Then get events for that user
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', businessProfile.user_id)
        .order('start_date', { ascending: true });

      if (error) {
        console.error("Error fetching business events:", error);
        return [];
      }

      console.log(`Fetched ${data?.length || 0} events for business user ${businessProfile.user_id}`);
      
      // Also fetch approved booking requests for this business
      const { data: approvedBookings, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved');
        
      if (bookingsError) {
        console.error("Error fetching approved bookings:", bookingsError);
      } else {
        console.log(`Fetched ${approvedBookings?.length || 0} approved booking requests`);
        
        // Convert booking requests to calendar events format and add them
        const bookingEvents = (approvedBookings || []).map(booking => ({
          id: booking.id,
          title: booking.title,
          start_date: booking.start_date,
          end_date: booking.end_date,
          type: 'booking_request',
          user_id: businessProfile.user_id,
          created_at: booking.created_at || new Date().toISOString(),
          requester_name: booking.requester_name,
          requester_email: booking.requester_email,
        }));
        
        return [...(data || []), ...bookingEvents];
      }
      
      return data || [];
    } catch (error) {
      console.error("Error in getBusinessEvents:", error);
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

    if (error) {
      console.error("Error creating event:", error);
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
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

    if (error) {
      console.error("Error updating event:", error);
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
    return data;
  };

  const deleteEvent = async (id: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Query for user events (used in dashboard)
  const { data: events = [], isLoading: isLoadingUserEvents, error: userEventsError } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 5000, // Refresh every 5 seconds to ensure sync
  });

  // Query for business events (used in external calendar)
  const { data: businessEvents = [], isLoading: isLoadingBusinessEvents, error: businessEventsError } = useQuery({
    queryKey: ['business-events', businessId],
    queryFn: getBusinessEvents,
    enabled: !!businessId,
    staleTime: 1000 * 60,
    refetchInterval: 5000, // Refresh more frequently (every 5 seconds)
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      toast({
        title: "Success", 
        description: "Event deleted successfully",
      });
    },
  });

  console.log(`Calendar events count: ${businessId ? businessEvents.length : events.length}`);

  return {
    events: businessId ? businessEvents : events, // Return business events if businessId is provided
    isLoading: businessId ? isLoadingBusinessEvents : isLoadingUserEvents,
    error: businessId ? businessEventsError : userEventsError,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};
