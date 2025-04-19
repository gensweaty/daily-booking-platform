import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export const useCalendarEvents = (businessId?: string, businessUserId?: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

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

  const getBusinessEvents = async () => {
    if (!businessId && !businessUserId) {
      return [];
    }
    
    let targetUserId = businessUserId;
    
    if (businessId && !targetUserId) {
      try {
        console.log("Fetching business user ID for business:", businessId);
        
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
        
        targetUserId = businessProfile.user_id;
        console.log("Found user_id for business:", targetUserId);
      } catch (error) {
        console.error("Error fetching business profile:", error);
        return [];
      }
    }
    
    if (!targetUserId) {
      console.error("No target user ID found to fetch business events");
      return [];
    }
    
    try {
      console.log("Fetching business events for user ID:", targetUserId);
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', targetUserId)
        .order('start_date', { ascending: true });

      if (error) {
        console.error("Error fetching business events:", error);
        return [];
      }
      
      console.log("Fetched business events:", data?.length || 0);
      return data || [];
    } catch (error) {
      console.error("Error fetching business events:", error);
      return [];
    }
  };

  const getApprovedBookings = async () => {
    if (!businessId && !businessUserId && !user) return [];

    try {
      let businessProfileId = businessId;
      
      if (!businessProfileId && !businessId && !businessUserId && user) {
        const { data: userBusinessProfile } = await supabase
          .from("business_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
          
        if (userBusinessProfile?.id) {
          businessProfileId = userBusinessProfile.id;
        }
      }
      
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
      
      const bookingEvents = (data || []).map(booking => ({
        id: booking.id,
        title: booking.title || 'Booking',
        start_date: booking.start_date,
        end_date: booking.end_date,
        type: 'booking_request',
        created_at: booking.created_at || new Date().toISOString(),
        user_id: booking.user_id || '',
        user_surname: booking.requester_name || '',
        user_number: booking.requester_phone || '',
        social_network_link: booking.requester_email || '',
        event_notes: booking.description || '',
        requester_name: booking.requester_name || '',
        requester_email: booking.requester_email || '',
        requester_phone: booking.requester_phone || '',
        description: booking.description || '',
      }));
      
      return bookingEvents;
    } catch (error) {
      console.error("Error fetching approved bookings:", error);
      return [];
    }
  };

  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to create events");
    
    const startDateTime = new Date(event.start_date as string);
    const endDateTime = new Date(event.end_date as string);
    
    const { available, conflictDetails } = await checkTimeSlotAvailability(
      startDateTime,
      endDateTime
    );
    
    if (!available) {
      throw new Error(`Time slot is no longer available: ${conflictDetails}`);
    }
    
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

  const updateEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    
    // Extract id from the data object
    const id = data.id;
    if (!id) throw new Error("Event ID is required for updates");
    
    console.log("Updating event with ID:", id, "Data:", data);
    console.log("Event type:", data.type);
    
    if (data.start_date && data.end_date) {
      const startDateTime = new Date(data.start_date);
      const endDateTime = new Date(data.end_date);
      
      // When updating an event, pass the current event id to exclude it from conflict checking
      const { available, conflictDetails } = await checkTimeSlotAvailability(
        startDateTime,
        endDateTime,
        id
      );
      
      if (!available) {
        throw new Error(`Time slot already booked: ${conflictDetails}`);
      }
    }
    
    // Handle booking request events
    if (data.type === 'booking_request' || (id && typeof id === 'string' && id.includes('-'))) {
      try {
        const { data: bookingData, error: bookingError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();
          
        if (!bookingError && bookingData) {
          console.log("Updating booking request:", id);
          const { data: updatedBooking, error: updateError } = await supabase
            .from('booking_requests')
            .update({
              title: data.title,
              requester_name: data.user_surname,
              requester_phone: data.user_number,
              requester_email: data.social_network_link,
              description: data.event_notes,
              start_date: data.start_date,
              end_date: data.end_date,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
              
          if (updateError) throw updateError;
          
          toast({
            title: "Booking updated",
            description: "The booking request has been updated successfully."
          });
          
          return {
            id: updatedBooking.id,
            title: updatedBooking.title,
            start_date: updatedBooking.start_date,
            end_date: updatedBooking.end_date,
            user_id: updatedBooking.user_id || '',
            user_surname: updatedBooking.requester_name,
            user_number: updatedBooking.user_number || '',
            social_network_link: updatedBooking.requester_email,
            event_notes: updatedBooking.description || '',
            type: 'booking_request',
            created_at: updatedBooking.created_at,
            requester_name: updatedBooking.requester_name,
            requester_email: updatedBooking.requester_email,
            requester_phone: updatedBooking.requester_phone || '',
          } as CalendarEventType;
        }
      } catch (error) {
        console.error("Error checking for booking request:", error);
      }
    }
    
    // Standard event update
    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update({
        title: data.title,
        user_surname: data.user_surname,
        user_number: data.user_number,
        social_network_link: data.social_network_link,
        event_notes: data.event_notes,
        start_date: data.start_date,
        end_date: data.end_date,
        payment_status: data.payment_status,
        payment_amount: data.payment_amount
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    toast({
      title: "Event updated",
      description: "Your event has been updated successfully."
    });
    
    return updatedEvent;
  };

  const checkTimeSlotAvailability = async (
    startDate: Date,
    endDate: Date,
    excludeEventId?: string
  ): Promise<{ available: boolean; conflictDetails: string }> => {
    try {
      console.log("Checking availability for:", {
        start: startDate,
        end: endDate,
        excludeEventId,
        userId: user?.id,
        businessId
      });
      
      if (!user) {
        return { available: true, conflictDetails: "" };
      }
      
      // Only check for events belonging to the current user or business being viewed
      const userId = businessId || businessUserId ? businessUserId : user.id;
      
      if (!userId) {
        return { available: true, conflictDetails: "" };
      }
      
      // Query for conflicting events
      const { data: conflictingEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, deleted_at')
        .eq('user_id', userId)
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString())
        .is('deleted_at', null);
      
      if (eventsError) throw eventsError;
      
      // Filter out the current event being updated
      const eventsConflict = conflictingEvents?.filter(event => 
        excludeEventId !== event.id &&
        !(startDate.getTime() >= new Date(event.end_date).getTime() || 
          endDate.getTime() <= new Date(event.start_date).getTime())
      );
      
      console.log("Conflicting events (excluding current):", eventsConflict);
      
      if (eventsConflict && eventsConflict.length > 0) {
        const conflictEvent = eventsConflict[0];
        return { 
          available: false, 
          conflictDetails: `Conflicts with "${conflictEvent.title}" at ${new Date(conflictEvent.start_date).toLocaleTimeString()}`
        };
      }
      
      // Only check bookings if we're viewing a business calendar or working with our own business
      if (businessId || businessUserId) {
        const targetBusinessId = businessId;
        
        if (targetBusinessId) {
          // Also check for booking conflicts, BUT EXCLUDE THE CURRENT BOOKING BEING EDITED
          const { data: conflictingBookings, error: bookingsError } = await supabase
            .from('booking_requests')
            .select('id, title, start_date, end_date')
            .eq('business_id', targetBusinessId)
            .eq('status', 'approved')
            .filter('start_date', 'lt', endDate.toISOString())
            .filter('end_date', 'gt', startDate.toISOString());
          
          if (bookingsError) throw bookingsError;
          
          // Filter out the current booking being updated
          const bookingsConflict = conflictingBookings?.filter(booking => 
            excludeEventId !== booking.id && // This is the key fix - exclude the current booking ID
            !(startDate.getTime() >= new Date(booking.end_date).getTime() || 
              endDate.getTime() <= new Date(booking.start_date).getTime())
          );
          
          console.log("Conflicting bookings (excluding current ID):", excludeEventId);
          console.log("Filtered conflicting bookings:", bookingsConflict);
          
          if (bookingsConflict && bookingsConflict.length > 0) {
            const conflictBooking = bookingsConflict[0];
            return { 
              available: false, 
              conflictDetails: `Conflicts with approved booking "${conflictBooking.title}" at ${new Date(conflictBooking.start_date).toLocaleTimeString()}`
            };
          }
        }
      } else if (!businessId && !businessUserId && user) {
        // If we're on our own calendar, check our business bookings too
        const { data: userBusinessProfile } = await supabase
          .from("business_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
          
        if (userBusinessProfile?.id) {
          const { data: conflictingBookings, error: bookingsError } = await supabase
            .from('booking_requests')
            .select('id, title, start_date, end_date')
            .eq('business_id', userBusinessProfile.id)
            .eq('status', 'approved')
            .filter('start_date', 'lt', endDate.toISOString())
            .filter('end_date', 'gt', startDate.toISOString());
            
          if (bookingsError) throw bookingsError;
          
          // Filter out the current booking being updated
          const bookingsConflict = conflictingBookings?.filter(booking => 
            excludeEventId !== booking.id &&
            !(startDate.getTime() >= new Date(booking.end_date).getTime() || 
              endDate.getTime() <= new Date(booking.start_date).getTime())
          );
          
          if (bookingsConflict && bookingsConflict.length > 0) {
            const conflictBooking = bookingsConflict[0];
            return { 
              available: false, 
              conflictDetails: `Conflicts with approved booking "${conflictBooking.title}" at ${new Date(conflictBooking.start_date).toLocaleTimeString()}`
            };
          }
        }
      }
      
      return { available: true, conflictDetails: "" };
    } catch (error) {
      console.error("Error checking time slot availability:", error);
      return { available: false, conflictDetails: "Error checking availability" };
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    try {
      // Check if this is a booking event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('booking_request_id')
        .eq('id', id)
        .maybeSingle();
        
      if (eventError) {
        console.error("Error checking for booking association:", eventError);
      } else if (eventData?.booking_request_id) {
        console.log("This is a booking event. Will also update booking request status.");
        // Update the booking request status to rejected/deleted
        const { error: bookingError } = await supabase
          .from('booking_requests')
          .update({ status: 'rejected' })
          .eq('id', eventData.booking_request_id);
          
        if (bookingError) {
          console.error("Error updating associated booking:", bookingError);
        }
      }
      
      // Also check if this is a direct booking request ID
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (!bookingError && bookingData) {
        console.log("Deleting booking request:", id);
        const { error } = await supabase
          .from('booking_requests')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        
        toast({
          title: "Booking deleted",
          description: "The booking request has been deleted successfully."
        });
        return;
      }
    } catch (error) {
      console.error("Error checking for booking request:", error);
    }
    
    // Find potentially related customer
    try {
      // Get the event first to use its data
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('title, start_date, end_date')
        .eq('id', id)
        .maybeSingle();
      
      if (eventError) {
        console.error('Error finding event:', eventError);
        // Continue with deletion even if we can't find the event data
      } else if (eventData) {
        // Check for associated customer using event data
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('title', eventData.title)
          .eq('start_date', eventData.start_date)
          .eq('end_date', eventData.end_date)
          .maybeSingle();

        if (customerError && customerError.code !== 'PGRST116') {
          console.error('Error finding associated customer:', customerError);
          // Don't throw, continue with deletion
        }

        if (customer) {
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              start_date: null,
              end_date: null
            })
            .eq('id', customer.id);

          if (updateError) {
            console.error('Error updating customer:', updateError);
            // Don't throw, continue with deletion
          }
        }
      }
    } catch (error) {
      console.error('Error handling customer association:', error);
      // Continue with deletion even if customer handling fails
    }

    // Check for and delete associated files
    try {
      const { data: files } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', id);

      if (files && files.length > 0) {
        for (const file of files) {
          const { error: storageError } = await supabase.storage
            .from('event_attachments')
            .remove([file.file_path]);

          if (storageError) {
            console.error('Error deleting file from storage:', storageError);
          }
        }

        const { error: filesDeleteError } = await supabase
          .from('event_files')
          .delete()
          .eq('event_id', id);

        if (filesDeleteError) {
          console.error('Error deleting file records:', filesDeleteError);
          // Don't throw, continue with deletion
        }
      }
    } catch (error) {
      console.error('Error handling file deletion:', error);
      // Continue with deletion even if file handling fails
    }

    // Finally delete the event
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    toast({
      title: "Success",
      description: "Event deleted successfully",
    });
  };

  const { data: events = [], isLoading: isLoadingUserEvents, error: userEventsError } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: !!user && !businessId && !businessUserId,
    staleTime: 1000 * 30,
    refetchInterval: 2000,
  });

  const { data: businessEvents = [], isLoading: isLoadingBusinessEvents, error: businessEventsError } = useQuery({
    queryKey: ['business-events', businessId, businessUserId],
    queryFn: getBusinessEvents,
    enabled: !!(businessId || businessUserId),
    staleTime: 1000 * 30,
    refetchInterval: 2000,
  });

  const { data: approvedBookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ['approved-bookings', businessId, businessUserId],
    queryFn: getApprovedBookings,
    enabled: !!(businessId || businessUserId || (user && !businessId && !businessUserId)),
    staleTime: 1000 * 30,
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

  let allEvents: CalendarEventType[] = [];
  
  if (businessId || businessUserId) {
    allEvents = [...businessEvents, ...approvedBookings];
  } else if (user) {
    const isUserBusiness = approvedBookings.length > 0 && approvedBookings[0].user_id === user.id;
    allEvents = [...events, ...(isUserBusiness ? approvedBookings : [])];
  }

  console.log("useCalendarEvents combined data:", {
    userEvents: events?.length || 0,
    businessEvents: businessEvents?.length || 0,
    approvedBookings: approvedBookings?.length || 0,
    combined: allEvents.length,
    isExternalCalendar: !!(businessId || businessUserId),
  });

  return {
    events: allEvents,
    isLoading: (businessId || businessUserId) ? (isLoadingBusinessEvents || isLoadingBookings) : (isLoadingUserEvents || isLoadingBookings),
    error: (businessId || businessUserId) ? businessEventsError : userEventsError,
    createEvent,
    updateEvent,
    deleteEvent,
    checkTimeSlotAvailability,
  };
};
