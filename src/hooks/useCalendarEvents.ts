import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
      description: "Your event has been added to the calendar.",
      duration: 5000, // Auto-dismiss after 5 seconds
    });
    
    return data;
  };

  const updateEvent = async (updateData: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    
    console.log("updateEvent received data:", updateData);
    
    const id = updateData.id;
    if (!id) throw new Error("Event ID is required for updates");
    
    // Extract the id from updateData to avoid duplication in the database update
    const { id: eventId, ...updates } = updateData;
    
    // Log received data for debugging
    console.log("updateEvent processing:", {
      id: eventId,
      updates,
      originalType: 'type' in updateData ? updateData.type : 'unknown'
    });
    
    if (updates.start_date && updates.end_date) {
      const startDateTime = new Date(updates.start_date);
      const endDateTime = new Date(updates.end_date);
      
      console.log("Checking availability for event update, EXPLICITLY excluding ID:", eventId);
      
      const { available, conflictDetails } = await checkTimeSlotAvailability(
        startDateTime,
        endDateTime,
        eventId
      );
      
      if (!available) {
        throw new Error(`Time slot already booked: ${conflictDetails}`);
      }
    }
    
    // Handle booking request type events
    if (updates.type === 'booking_request' || (id && id.includes('-'))) {
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
              title: updates.title,
              requester_name: updates.user_surname,
              requester_phone: updates.user_number,
              requester_email: updates.social_network_link,
              description: updates.event_notes,
              start_date: updates.start_date,
              end_date: updates.end_date,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
              
          if (updateError) throw updateError;
          
          toast({
            title: "Booking updated",
            description: "The booking request has been updated successfully.",
            duration: 5000, // Auto-dismiss after 5 seconds
          });
          
          return {
            id: updatedBooking.id,
            title: updatedBooking.title,
            start_date: updatedBooking.start_date,
            end_date: updatedBooking.end_date,
            user_id: updatedBooking.user_id || '',
            user_surname: updatedBooking.requester_name,
            user_number: updatedBooking.requester_phone || '',
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
    
    console.log("Updating regular event with ID:", eventId, "and data:", updates);
    
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      throw error;
    }
    
    toast({
      title: "Event updated",
      description: "Your event has been updated successfully.",
      duration: 5000, // Auto-dismiss after 5 seconds
    });
    
    return data;
  };

  const checkTimeSlotAvailability = async (
    startDate: Date,
    endDate: Date,
    excludeEventId?: string
  ): Promise<{ available: boolean; conflictDetails: string }> => {
    try {
      console.log("CHECK AVAILABILITY - Params:", {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        excludeEventId: excludeEventId,
        userId: user?.id,
        businessId
      });
      
      if (!user) {
        return { available: true, conflictDetails: "" };
      }
      
      const userId = businessId || businessUserId ? businessUserId : user.id;
      
      if (!userId) {
        return { available: true, conflictDetails: "" };
      }
      
      // Explicitly log the excluded event ID for debugging
      console.log("EXPLICITLY excluding event with ID:", excludeEventId);
      
      // First check regular events
      const { data: conflictingEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, deleted_at')
        .eq('user_id', userId)
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString())
        .is('deleted_at', null);
      
      if (eventsError) throw eventsError;
      
      console.log("CHECKING - All potential conflicting events:", conflictingEvents);
      
      const eventsConflict = conflictingEvents?.filter(event => {
        // Check if this is the event being edited (to exclude it)
        const isExcludedEvent = event.id === excludeEventId;
        console.log(`Event ${event.id} === excludeEventId ${excludeEventId}? ${isExcludedEvent}`);
        
        // Check for time overlap
        const hasTimeConflict = !(
          startDate.getTime() >= new Date(event.end_date).getTime() || 
          endDate.getTime() <= new Date(event.start_date).getTime()
        );
        
        console.log(`Event ${event.id} has time conflict? ${hasTimeConflict}`);
        
        // Only return events that are not the excluded event AND have a time conflict
        return !isExcludedEvent && hasTimeConflict;
      });
      
      console.log("CHECKING - Filtered conflicting events:", eventsConflict);
      
      if (eventsConflict && eventsConflict.length > 0) {
        const conflictEvent = eventsConflict[0];
        console.log("CONFLICT - Found conflicting event:", conflictEvent);
        return { 
          available: false, 
          conflictDetails: `Conflicts with "${conflictEvent.title}" at ${new Date(conflictEvent.start_date).toLocaleTimeString()}`
        };
      }
      
      // Check for business booking conflicts
      if (businessId || businessUserId) {
        const targetBusinessId = businessId;
        
        if (targetBusinessId) {
          const { data: conflictingBookings, error: bookingsError } = await supabase
            .from('booking_requests')
            .select('id, title, start_date, end_date')
            .eq('business_id', targetBusinessId)
            .eq('status', 'approved')
            .filter('start_date', 'lt', endDate.toISOString())
            .filter('end_date', 'gt', startDate.toISOString());
          
          if (bookingsError) throw bookingsError;
          
          console.log("CHECKING - All potential conflicting bookings:", conflictingBookings);
          
          const bookingsConflict = conflictingBookings?.filter(booking => {
            const isExcludedBooking = booking.id === excludeEventId;
            console.log(`Booking ${booking.id} === excludeEventId ${excludeEventId}? ${isExcludedBooking}`);
            
            const hasTimeConflict = !(
              startDate.getTime() >= new Date(booking.end_date).getTime() || 
              endDate.getTime() <= new Date(booking.start_date).getTime()
            );
            
            console.log(`Booking ${booking.id} has time conflict? ${hasTimeConflict}`);
            
            // Only return bookings that are not the excluded booking AND have a time conflict
            return !isExcludedBooking && hasTimeConflict;
          });
          
          console.log("CHECKING - Filtered conflicting bookings:", bookingsConflict);
          
          if (bookingsConflict && bookingsConflict.length > 0) {
            const conflictBooking = bookingsConflict[0];
            console.log("CONFLICT - Found conflicting booking:", conflictBooking);
            return { 
              available: false, 
              conflictDetails: `Conflicts with approved booking "${conflictBooking.title}" at ${new Date(conflictBooking.start_date).toLocaleTimeString()}`
            };
          }
        }
      } else if (!businessId && !businessUserId && user) {
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
          
          console.log("All potential conflicting user bookings:", conflictingBookings);
          
          const bookingsConflict = conflictingBookings?.filter(booking => {
            const isExcludedBooking = booking.id === excludeEventId;
            console.log(`Booking ${booking.id} is excluded booking? ${isExcludedBooking}`);
            
            const hasTimeConflict = !(
              startDate.getTime() >= new Date(booking.end_date).getTime() || 
              endDate.getTime() <= new Date(booking.start_date).getTime()
            );
            
            // Only return true if it's not the excluded booking AND there's a time conflict
            return !isExcludedBooking && hasTimeConflict;
          });
          
          console.log("Conflicting user bookings (excluding current):", bookingsConflict);
          
          if (bookingsConflict && bookingsConflict.length > 0) {
            const conflictBooking = bookingsConflict[0];
            console.log("Found conflicting user booking:", conflictBooking);
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
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('booking_request_id')
        .eq('id', id)
        .maybeSingle();
        
      if (eventError) {
        console.error("Error checking for booking association:", eventError);
      } else if (eventData?.booking_request_id) {
        console.log("This is a booking event. Will also update booking request status.");
        const { error: bookingError } = await supabase
          .from('booking_requests')
          .update({ status: 'rejected' })
          .eq('id', eventData.booking_request_id);
          
        if (bookingError) {
          console.error("Error updating associated booking:", bookingError);
        }
      }
      
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
    
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('title, start_date, end_date')
        .eq('id', id)
        .maybeSingle();
      
      if (eventError) {
        console.error('Error finding event:', eventError);
      } else if (eventData) {
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('title', eventData.title)
          .eq('start_date', eventData.start_date)
          .eq('end_date', eventData.end_date)
          .maybeSingle();

        if (customerError && customerError.code !== 'PGRST116') {
          console.error('Error finding associated customer:', customerError);
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
          }
        }
      }
    } catch (error) {
      console.error('Error handling customer association:', error);
    }

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
        }
      }
    } catch (error) {
      console.error('Error handling file deletion:', error);
    }

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
