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
    
    const id = data.id;
    if (!id) throw new Error("Event ID is required for updates");
    
    console.log("Updating event with ID:", id);
    console.log("Update data:", data);
    console.log("Event type:", data.type);
    
    if (data.start_date && data.end_date) {
      let skipTimeCheck = false;
      let originalEvent: any = null;
      
      if (data.type === 'booking_request' || (id && typeof id === 'string' && id.includes('-'))) {
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
        const { data: eventData } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .maybeSingle();
          
        if (eventData) {
          originalEvent = eventData;
        }
      }
      
      if (originalEvent) {
        skipTimeCheck = !haveTimesChanged(
          originalEvent.start_date,
          originalEvent.end_date,
          data.start_date,
          data.end_date
        );
        
        console.log("Should skip time conflict check?", skipTimeCheck);
      }
      
      if (!skipTimeCheck) {
        const startDateTime = new Date(data.start_date);
        const endDateTime = new Date(data.end_date);
        
        const { available, conflictDetails } = await checkTimeSlotAvailability(
          startDateTime,
          endDateTime,
          id
        );
        
        if (!available) {
          throw new Error(`Time slot already booked: ${conflictDetails}`);
        }
      }
    }
    
    let wasBookingRequest = false;
    let bookingFile = null;
    
    if (data.type === 'booking_request' || (id && typeof id === 'string' && id.includes('-'))) {
      try {
        console.log("Checking for booking request with ID:", id);
        const { data: bookingData, error: bookingError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();
          
        if (!bookingError && bookingData) {
          console.log("Found booking request, updating:", id);
          wasBookingRequest = true;
          
          if (bookingData.file_path) {
            bookingFile = {
              file_path: bookingData.file_path,
              filename: bookingData.filename || 'attachment'
            };
            console.log("Booking has associated file:", bookingFile);
          }
          
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
          
          if (data.type === 'booking_request') {
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
          }
          
          const eventPayload = {
            title: data.title,
            user_surname: data.user_surname,
            user_number: data.user_number,
            social_network_link: data.social_network_link,
            event_notes: data.event_notes,
            start_date: data.start_date,
            end_date: data.end_date,
            payment_status: data.payment_status,
            payment_amount: data.payment_amount,
            user_id: user.id,
            booking_request_id: id,
            type: 'event',
            file_path: bookingFile?.file_path || null,
            filename: bookingFile?.filename || null
          };
          
          console.log("Creating new event from booking request with file data:", eventPayload);
          
          const { data: newEvent, error: createError } = await supabase
            .from('events')
            .insert(eventPayload)
            .select()
            .single();
            
          if (createError) throw createError;
          
          console.log("Successfully created event from booking request:", newEvent);
          
          if (bookingFile && newEvent.id) {
            console.log("Creating file record for booking file:", bookingFile);
            
            const { error: fileError } = await supabase
              .from('event_files')
              .insert({
                event_id: newEvent.id,
                file_path: bookingFile.file_path,
                filename: bookingFile.filename,
                content_type: 'application/octet-stream',
                size: 0,
                user_id: user.id,
                source: 'booking_request'
              });
              
            if (fileError) {
              console.error("Error creating file record for booking file:", fileError);
            } else {
              console.log("Successfully created file record for booking file");
            }
          }
          
          try {
            const customerData = {
              title: data.title,
              user_surname: data.user_surname,
              user_number: data.user_number,
              social_network_link: data.social_network_link,
              event_notes: data.event_notes,
              start_date: data.start_date,
              end_date: data.end_date,
              payment_status: data.payment_status || null,
              payment_amount: data.payment_amount || null,
              user_id: user.id,
              type: 'customer',
              create_event: false,
              file_path: bookingFile?.file_path || null,
              filename: bookingFile?.filename || null
            };

            console.log("Creating customer from approved booking with file data:", customerData);
            
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert(customerData)
              .select()
              .single();
              
            if (customerError) {
              console.error("Error creating customer from booking:", customerError);
            } else if (newCustomer && bookingFile) {
              console.log("Created customer from booking, transferring file:", newCustomer);
              
              const { error: customerFileError } = await supabase
                .from('customer_files_new')
                .insert({
                  customer_id: newCustomer.id,
                  file_path: bookingFile.file_path,
                  filename: bookingFile.filename,
                  content_type: 'application/octet-stream',
                  size: 0,
                  user_id: user.id,
                  source: 'booking_request'
                });
                
              if (customerFileError) {
                console.error("Error creating file record for customer:", customerFileError);
              } else {
                console.log("Successfully created file record for customer");
              }

              const { error: eventUpdateError } = await supabase
                .from('events')
                .update({ customer_id: newCustomer.id })
                .eq('id', newEvent.id);
                
              if (eventUpdateError) {
                console.error("Error updating event with customer ID:", eventUpdateError);
              }
            }
          } catch (customerCreationError) {
            console.error("Error in customer creation flow:", customerCreationError);
          }
          
          toast({
            title: "Booking approved",
            description: "The booking request has been approved and converted to an event."
          });
          
          return newEvent;
        } else {
          console.log("No booking request found with ID:", id);
        }
      } catch (error) {
        console.error("Error checking for booking request:", error);
        throw error;
      }
    }
    
    console.log("Updating standard event:", id);
    
    let updateData: any = {
      title: data.title,
      user_surname: data.user_surname,
      user_number: data.user_number,
      social_network_link: data.social_network_link,
      event_notes: data.event_notes,
      start_date: data.start_date,
      end_date: data.end_date,
      payment_status: data.payment_status,
      payment_amount: data.payment_amount
    };
    
    if (data.booking_request_id) {
      updateData.booking_request_id = data.booking_request_id;
    }
    
    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update(updateData)
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
      
      const userId = businessId || businessUserId ? businessUserId : user.id;
      
      if (!userId) {
        return { available: true, conflictDetails: "" };
      }
      
      const { data: conflictingEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, deleted_at, type')
        .eq('user_id', userId)
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString())
        .is('deleted_at', null);
      
      if (eventsError) throw eventsError;
      
      const isSameEvent = (item: any) => {
        return item.id === excludeEventId;
      };
      
      const eventsConflict = conflictingEvents?.filter(event => 
        !isSameEvent(event) &&
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
      
      if (businessId || businessUserId) {
        const targetBusinessId = businessId;
        
        if (targetBusinessId) {
          console.log("Booking conflict check for excludeEventId:", excludeEventId);
          
          const { data: conflictingBookings, error: bookingsError } = await supabase
            .from('booking_requests')
            .select('id, title, start_date, end_date, type')
            .eq('business_id', targetBusinessId)
            .eq('status', 'approved')
            .filter('start_date', 'lt', endDate.toISOString())
            .filter('end_date', 'gt', startDate.toISOString());
          
          if (bookingsError) throw bookingsError;
          
          console.log("Booking conflict check against:", {
            excludeId: excludeEventId,
            conflictingBookings: conflictingBookings?.map(b => b.id)
          });
          
          const isSameBooking = (booking: any) => {
            return booking.id === excludeEventId;
          };
          
          const bookingsConflict = conflictingBookings?.filter(booking => 
            !isSameBooking(booking) &&
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
          
          console.log("Booking conflict check against:", {
            excludeId: excludeEventId,
            conflictingBookings: conflictingBookings?.map(b => b.id)
          });
          
          const isSameBooking = (booking: any) => {
            return booking.id === excludeEventId;
          };
          
          const bookingsConflict = conflictingBookings?.filter(booking => 
            !isSameBooking(booking) &&
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
