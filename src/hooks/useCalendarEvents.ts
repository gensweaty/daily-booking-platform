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

  // Helper to determine if times have changed between original and new dates
  const haveTimesChanged = (
    originalStartDate: string,
    originalEndDate: string,
    newStartDate: string,
    newEndDate: string
  ): boolean => {
    const originalStart = new Date(originalStartDate).getTime();
    const originalEnd = new Date(originalEndDate).getTime();
    const newStart = new Date(newStartDate).getTime();
    const newEnd = new Date(newEndDate).getTime();
    
    const timesChanged = originalStart !== newStart || originalEnd !== newEnd;
    
    console.log("Time change check in useCalendarEvents:", {
      originalStart,
      originalEnd,
      newStart,
      newEnd,
      changed: timesChanged
    });
    
    return timesChanged;
  };

  const getEvents = async () => {
    if (!user) return [];
    
    console.log("Fetching user events for user:", user.id);
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null) // Ensure we only get non-deleted events
        .order('start_date', { ascending: true });

      if (error) {
        console.error("Error fetching user events:", error);
        throw error;
      }
      
      console.log("Fetched user events:", data?.length || 0);
      if (data && data.length > 0) {
        console.log("Sample event data:", data[0]);
        
        // Check for events without a type
        const eventsWithoutType = data.filter(event => !event.type);
        if (eventsWithoutType.length > 0) {
          console.warn("Found events without type:", eventsWithoutType.length);
          
          // Update events to have a default type
          for (const event of eventsWithoutType) {
            await supabase
              .from('events')
              .update({ type: 'event' })
              .eq('id', event.id);
          }
          
          console.log("Updated events without type to have default type 'event'");
        }
      }
      
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
        .is('deleted_at', null) // Ensure we only get non-deleted events
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
        // Removed the deleted_at IS NULL check since the column doesn't exist
        
      if (error) {
        console.error("Error fetching approved bookings:", error);
        return [];
      }
      
      console.log("Fetched approved bookings:", data?.length || 0);
      
      const bookingEvents = (data || []).map(booking => {
        // Create event object with proper fall-back and type safety
        return {
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
          // Add optional file metadata properties
          file_path: booking.file_path,
          filename: booking.filename,
          content_type: booking.content_type,
          file_size: booking.file_size,
          size: booking.size
        } as CalendarEventType;
      });
      
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
    
    try {
      const { available, conflictDetails } = await checkTimeSlotAvailability(
        startDateTime,
        endDateTime
      );
      
      if (!available) {
        throw new Error(`Time slot is no longer available: ${conflictDetails}`);
      }
      
      // Make sure the type field is set, defaulting to 'event'
      if (!event.type) {
        event.type = 'event';
      }
      
      console.log("Creating event with data:", { ...event, user_id: user.id });
      
      const { data, error } = await supabase
        .from('events')
        .insert([{ ...event, user_id: user.id }])
        .select()
        .single();

      if (error) {
        console.error("Error creating event:", error);
        throw error;
      }
      
      console.log("Successfully created event:", data);
      
      toast({
        title: "Event created",
        description: "Your event has been added to the calendar."
      });
      
      return data;
    } catch (error: any) {
      console.error("Error in createEvent:", error);
      throw error;
    }
  };

  const updateEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    
    const id = data.id;
    if (!id) throw new Error("Event ID is required for updates");
    
    console.log("Updating event with ID:", id);
    console.log("Update data:", data);
    console.log("Event type:", data.type);
    
    // For existing events, first check if we need to validate time conflicts
    if (data.start_date && data.end_date) {
      // First get the original event to check if times changed
      let skipTimeCheck = false;
      let originalEvent: any = null;
      
      try {
        if (data.type === 'booking_request' || (id && typeof id === 'string' && id.includes('-'))) {
          // Check for booking request with this ID
          const { data: bookingData } = await supabase
            .from('booking_requests')
            .select('*')
            .eq('id', id)
            .maybeSingle();
            
          if (bookingData) {
            originalEvent = bookingData;
          }
        }
        
        if (!originalEvent) {
          // Check for regular event
          const { data: eventData } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .maybeSingle();
            
          if (eventData) {
            originalEvent = eventData;
          }
        }
        
        // If we found the original event, check if times changed
        if (originalEvent) {
          skipTimeCheck = !haveTimesChanged(
            originalEvent.start_date,
            originalEvent.end_date,
            data.start_date,
            data.end_date
          );
          
          console.log("Should skip time conflict check?", skipTimeCheck);
        }
        
        // Only perform conflict check if times have changed
        if (!skipTimeCheck) {
          const startDateTime = new Date(data.start_date);
          const endDateTime = new Date(data.end_date);
          
          try {
            const { available, conflictDetails } = await checkTimeSlotAvailability(
              startDateTime,
              endDateTime,
              id
            );
            
            if (!available) {
              throw new Error(`Time slot already booked: ${conflictDetails}`);
            }
          } catch (checkError) {
            console.error("Error checking time slot availability:", checkError);
            throw checkError;
          }
        }
      } catch (error) {
        console.error("Error in update event time check:", error);
        throw error;
      }
    }
    
    try {
      if (data.type === 'booking_request' || (id && typeof id === 'string' && id.includes('-'))) {
        console.log("Checking for booking request with ID:", id);
        const { data: bookingData, error: bookingError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();
          
        if (!bookingError && bookingData) {
          console.log("Found booking request, updating:", id);
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
            user_number: updatedBooking.requester_phone || '',
            social_network_link: updatedBooking.requester_email,
            event_notes: updatedBooking.description || '',
            type: 'booking_request',
            created_at: updatedBooking.created_at,
            requester_name: updatedBooking.requester_name,
            requester_email: updatedBooking.requester_email,
            requester_phone: updatedBooking.requester_phone || '',
          } as CalendarEventType;
        } else {
          console.log("No booking request found with ID:", id);
        }
      }
      
      console.log("Updating standard event:", id);
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
    } catch (error) {
      console.error("Error in updateEvent:", error);
      throw error;
    }
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
      
      const userId = businessId || businessUserId ? businessUserId : user.id;
      
      if (!userId) {
        return { available: true, conflictDetails: "" };
      }
      
      try {
        // FIXED: Added explicit filter for deleted_at IS NULL to exclude deleted events
        const { data: conflictingEvents, error: eventsError } = await supabase
          .from('events')
          .select('id, title, start_date, end_date, deleted_at, type')
          .eq('user_id', userId)
          .filter('start_date', 'lt', endDate.toISOString())
          .filter('end_date', 'gt', startDate.toISOString())
          .is('deleted_at', null); // This ensures we only check against non-deleted events
        
        if (eventsError) {
          console.error("Error checking events conflicts:", eventsError);
          return { available: true, conflictDetails: "" };
        }
        
        // Helper function to identify if this is the event being edited
        const isSameEvent = (item: any) => {
          return item.id === excludeEventId;
        };
        
        // Log what we got before filtering
        console.log("Found potential conflicting events before filtering:", conflictingEvents?.length || 0);
        
        const eventsConflict = conflictingEvents?.filter(event => 
          !isSameEvent(event) &&
          !(startDate.getTime() >= new Date(event.end_date).getTime() || 
            endDate.getTime() <= new Date(event.start_date).getTime())
        );
        
        console.log("Conflicting events (excluding current):", eventsConflict?.length || 0);
        
        if (eventsConflict && eventsConflict.length > 0) {
          const conflictEvent = eventsConflict[0];
          return { 
            available: false, 
            conflictDetails: `Conflicts with "${conflictEvent.title}" at ${new Date(conflictEvent.start_date).toLocaleTimeString()}`
          };
        }
      } catch (eventsCheckError) {
        console.error("Error during events conflict check:", eventsCheckError);
      }
      
      // Check for booking conflicts
      try {
        if (businessId || businessUserId) {
          const targetBusinessId = businessId;
          
          if (targetBusinessId) {
            console.log("Booking conflict check for excludeEventId:", excludeEventId);
            
            // FIXED: Added explicit filter for deleted_at IS NULL to exclude deleted bookings
            const { data: conflictingBookings, error: bookingsError } = await supabase
              .from('booking_requests')
              .select('id, title, start_date, end_date, type, deleted_at')
              .eq('business_id', targetBusinessId)
              .eq('status', 'approved')
              .filter('start_date', 'lt', endDate.toISOString())
              .filter('end_date', 'gt', startDate.toISOString());
            
            if (bookingsError) {
              console.error("Error checking booking conflicts:", bookingsError);
              return { available: true, conflictDetails: "" };
            }
            
            console.log("Booking conflict check against:", {
              excludeId: excludeEventId,
              conflictingBookings: conflictingBookings?.map(b => b.id)
            });
            
            // Helper function to identify if this is the booking being edited
            const isSameBooking = (booking: any) => {
              return booking.id === excludeEventId;
            };
            
            // Log what we got before filtering
            console.log("Found potential conflicting bookings before filtering:", conflictingBookings?.length || 0);
            
            // Check for conflicting bookings
            const bookingsConflict = conflictingBookings?.filter(booking => 
              !isSameBooking(booking) &&
              booking.deleted_at === null && // Skip deleted bookings
              !(startDate.getTime() >= new Date(booking.end_date).getTime() || 
                endDate.getTime() <= new Date(booking.start_date).getTime())
            );
            
            console.log("Filtered conflicting bookings:", bookingsConflict?.length || 0);
            
            if (bookingsConflict && bookingsConflict.length > 0) {
              const conflictBooking = bookingsConflict[0];
              return { 
                available: false, 
                conflictDetails: `Conflicts with approved booking "${conflictBooking.title}" at ${new Date(conflictBooking.start_date).toLocaleTimeString()}`
              };
            }
          }
        } else if (!businessId && !businessUserId && user) {
          // Check for user's own business bookings
          const { data: userBusinessProfile } = await supabase
            .from("business_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
            
          if (userBusinessProfile?.id) {
            const { data: conflictingBookings, error: bookingsError } = await supabase
              .from('booking_requests')
              .select('id, title, start_date, end_date, deleted_at')
              .eq('business_id', userBusinessProfile.id)
              .eq('status', 'approved')
              .filter('start_date', 'lt', endDate.toISOString())
              .filter('end_date', 'gt', startDate.toISOString());
              
            if (bookingsError) {
              console.error("Error checking user booking conflicts:", bookingsError);
              return { available: true, conflictDetails: "" };
            }
            
            console.log("User booking conflict check against:", {
              excludeId: excludeEventId,
              conflictingBookings: conflictingBookings?.map(b => b.id)
            });
            
            // Helper function to identify if this is the booking being edited
            const isSameBooking = (booking: any) => {
              return booking.id === excludeEventId;
            };
            
            // Check for conflicting bookings
            const bookingsConflict = conflictingBookings?.filter(booking => 
              !isSameBooking(booking) &&
              booking.deleted_at === null && // Skip deleted bookings
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
      } catch (bookingCheckError) {
        console.error("Error during booking conflict check:", bookingCheckError);
      }
      
      return { available: true, conflictDetails: "" };
    } catch (error) {
      console.error("Error checking time slot availability:", error);
      return { available: true, conflictDetails: "" }; // Return available=true for error cases to prevent blocking
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    try {
      // First check if this is a booking event with an associated booking request
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('booking_request_id, type')
        .eq('id', id)
        .maybeSingle();
        
      if (eventError) {
        console.error("Error checking for booking association:", eventError);
      } else if (eventData?.booking_request_id) {
        console.log("This is a booking event. Will also update booking request status.");
        const { error: bookingError } = await supabase
          .from('booking_requests')
          .update({ 
            status: 'rejected'
            // Removed deleted_at field since it doesn't exist in the table
          })
          .eq('id', eventData.booking_request_id);
          
        if (bookingError) {
          console.error("Error updating associated booking:", bookingError);
        } else {
          console.log("Successfully updated associated booking request status to rejected");
        }
      }
      
      // Check if this is a direct booking request (from booking_requests table)
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (!bookingError && bookingData) {
        console.log("Updating booking request status:", id);
        const { error } = await supabase
          .from('booking_requests')
          .update({
            // Removed deleted_at field since it doesn't exist in the table
            status: 'rejected'
          })
          .eq('id', id);
          
        if (error) {
          console.error("Error updating booking request status:", error);
          throw error;
        }
        
        toast({
          title: "Booking deleted",
          description: "The booking request has been rejected successfully."
        });
        return;
      }
    } catch (error) {
      console.error("Error checking for booking request:", error);
    }
    
    try {
      // Handle any customer relations
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('title, start_date, end_date')
        .eq('id', id)
        .maybeSingle();
      
      if (eventError) {
        console.error('Error finding event:', eventError);
      } else if (eventData) {
        // Check for related customer data
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
          // Update the customer record instead of deleting it
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              start_date: null,
              end_date: null
            })
            .eq('id', customer.id);

          if (updateError) {
            console.error('Error updating customer:', updateError);
          } else {
            console.log('Successfully updated customer record on event deletion');
          }
        }
      }
    } catch (error) {
      console.error('Error handling customer association:', error);
    }

    try {
      // Handle associated files
      const { data: files } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', id);

      if (files && files.length > 0) {
        // We're not deleting the actual files, just updating the relationship
        console.log(`Found ${files.length} associated files`);
      }
    } catch (error) {
      console.error('Error handling file associations:', error);
    }

    // Use soft delete for events instead of hard delete
    const { error } = await supabase
      .from('events')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error soft-deleting event:', error);
      throw error;
    }
    
    console.log('Successfully soft-deleted event:', id);
    
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
    refetchInterval: 2000, // Refresh every 2 seconds to ensure up-to-date data
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
    // Make sure we filter out deleted events
    const filteredBusinessEvents = businessEvents.filter(event => !event.deleted_at);
    const filteredApprovedBookings = approvedBookings.filter(booking => !booking.deleted_at);
    allEvents = [...filteredBusinessEvents, ...filteredApprovedBookings];
  } else if (user) {
    const isUserBusiness = approvedBookings.length > 0 && approvedBookings[0].user_id === user.id;
    // Filter out deleted events in both arrays
    const filteredEvents = events.filter(event => !event.deleted_at);
    const filteredBookings = isUserBusiness ? approvedBookings.filter(booking => !booking.deleted_at) : [];
    allEvents = [...filteredEvents, ...filteredBookings];
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
