
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { associateBookingFilesWithEvent } from "@/integrations/supabase/client";

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
        .eq('status', 'approved')
        .is('deleted_at', null); // Add check for soft-deleted bookings
        
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
        deleted_at: booking.deleted_at // Add deleted_at to the mapped object
      }));
      
      return bookingEvents;
    } catch (error) {
      console.error("Error fetching approved bookings:", error);
      return [];
    }
  };

  // Function to check if a time slot is available
  const checkTimeSlotAvailability = async (startDate: Date, endDate: Date, eventId?: string) => {
    if (!user) {
      return { available: false, conflictDetails: "User not authenticated" };
    }
    
    try {
      // Check for conflicts with existing events
      const { data: existingEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date')
        .eq('user_id', user.id)
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString())
        .is('deleted_at', null);
      
      if (eventsError) {
        console.error("Error checking event conflicts:", eventsError);
        return { available: false, conflictDetails: "Error checking schedule" };
      }
      
      // If we're editing an existing event, filter out the current event from conflicts
      const conflicts = eventId 
        ? existingEvents?.filter(e => e.id !== eventId)
        : existingEvents;
      
      if (conflicts && conflicts.length > 0) {
        console.log("Found conflicting events:", conflicts);
        
        const firstConflict = conflicts[0];
        return {
          available: false,
          conflictDetails: `Conflicts with "${firstConflict.title}" from ${
            new Date(firstConflict.start_date).toLocaleTimeString()} to ${
            new Date(firstConflict.end_date).toLocaleTimeString()}`
        };
      }
      
      // Check for conflicts with approved booking requests
      const businessProfileQuery = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (businessProfileQuery.error) {
        console.error("Error fetching business profile:", businessProfileQuery.error);
        // Continue checking availability even if we can't check bookings
      } else if (businessProfileQuery.data?.id) {
        const businessId = businessProfileQuery.data.id;
        
        const { data: approvedBookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('id, title, start_date, end_date')
          .eq('business_id', businessId)
          .eq('status', 'approved')
          .filter('start_date', 'lt', endDate.toISOString())
          .filter('end_date', 'gt', startDate.toISOString())
          .is('deleted_at', null);
          
        if (bookingsError) {
          console.error("Error checking booking conflicts:", bookingsError);
          // Continue checking availability even if this fails
        } else if (approvedBookings && approvedBookings.length > 0) {
          // If editing, don't count the booking that corresponds to this event
          const bookingConflicts = eventId
            ? approvedBookings.filter(b => b.id !== eventId)
            : approvedBookings;
            
          if (bookingConflicts.length > 0) {
            console.log("Found conflicting bookings:", bookingConflicts);
            
            const firstConflict = bookingConflicts[0];
            return {
              available: false,
              conflictDetails: `Conflicts with approved booking "${firstConflict.title}" from ${
                new Date(firstConflict.start_date).toLocaleTimeString()} to ${
                new Date(firstConflict.end_date).toLocaleTimeString()}`
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
    
    // Make sure the type field is set, defaulting to 'event'
    if (!event.type) {
      event.type = 'event';
    }
    
    // Create the event
    const { data, error } = await supabase
      .from('events')
      .insert({
        ...event,
        user_id: user.id
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error creating event:', error);
      throw error;
    }
    
    // Get business address for notification email
    try {
      // Fetch business profile for the user
      const { data: businessProfile, error: profileError } = await supabase
        .from('business_profiles')
        .select('contact_address, name')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (profileError) {
        console.error('Error fetching business address:', profileError);
      } else if (businessProfile && (event.user_number || event.social_network_link)) {
        // Only send email if we have customer contact info
        console.log('Sending booking confirmation email with address:', businessProfile.contact_address);
        
        const recipientEmail = event.social_network_link;
        if (recipientEmail && isValidEmail(recipientEmail)) {
          // Send booking confirmation email
          const supabaseApiUrl = import.meta.env.VITE_SUPABASE_URL;
          
          await fetch(`${supabaseApiUrl}/functions/v1/send-booking-approval-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              recipientEmail: recipientEmail,
              fullName: event.title || event.user_surname || '',
              businessName: businessProfile.name || '',
              startDate: event.start_date,
              endDate: event.end_date,
              paymentStatus: event.payment_status || 'not_paid',
              paymentAmount: event.payment_amount || 0,
              businessAddress: businessProfile.contact_address || ''
            })
          });
        }
      }
    } catch (emailError) {
      console.error('Error sending booking confirmation email:', emailError);
      // Don't throw error here, the event was created successfully
    }
    
    return data;
  };

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const updateEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    if (!event.id) throw new Error("Event ID is required for updates");
    
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('id, start_date, end_date, type')
      .eq('id', event.id)
      .single();
      
    if (fetchError) {
      console.error('Error fetching existing event:', fetchError);
      throw fetchError;
    }
    
    const startDateTime = new Date(event.start_date as string);
    const endDateTime = new Date(event.end_date as string);
    
    // Only check availability if times have changed
    const timesChanged = haveTimesChanged(
      existingEvent.start_date,
      existingEvent.end_date,
      event.start_date as string,
      event.end_date as string
    );
    
    if (timesChanged) {
      const { available, conflictDetails } = await checkTimeSlotAvailability(
        startDateTime,
        endDateTime,
        event.id
      );
      
      if (!available) {
        throw new Error(`Time slot is no longer available: ${conflictDetails}`);
      }
    }
    
    // If an event's type is booking_request but update sets it to something else,
    // this indicates approving a booking request
    const wasBookingRequest = existingEvent.type === 'booking_request';
    const isChangingType = event.type && event.type !== 'booking_request';
    
    if (wasBookingRequest && isChangingType) {
      console.log("Converting booking request to regular event:", event.id);
      
      // Always preserve original booking ID
      const bookingRequestId = event.id;
      
      // Create a new event without direct file fields
      const eventPayload = {
        // Use event payload data without file fields
        title: event.title,
        user_surname: event.user_surname,
        user_number: event.user_number,
        social_network_link: event.social_network_link,
        event_notes: event.event_notes,
        start_date: event.start_date,
        end_date: event.end_date,
        payment_status: event.payment_status || 'not_paid',
        payment_amount: event.payment_amount,
        user_id: user.id,
        booking_request_id: bookingRequestId,
        type: event.type || 'event'
      };
      
      // Create a new event first
      const { data: newEvent, error: createError } = await supabase
        .from('events')
        .insert(eventPayload)
        .select()
        .single();
        
      if (createError) {
        console.error("Error creating new event from booking:", createError);
        throw createError;
      }
      
      // Associate booking files with the new event
      let associatedFiles = null;
      try {
        const associatedFile = await associateBookingFilesWithEvent(
          bookingRequestId, 
          newEvent.id, 
          user.id
        );
        
        // Create an array with the file if it exists
        associatedFiles = associatedFile ? [associatedFile] : [];
        
        console.log("Associated files with new event:", associatedFiles);
      } catch (fileError) {
        console.error("Error copying booking files:", fileError);
        associatedFiles = [];
      }
      
      // Create a customer record if we have customer data in the booking
      try {
        if (event.user_surname || event.requester_name) {
          console.log("Creating customer record from booking request");
          
          const customerData = {
            title: event.user_surname || event.requester_name || event.title || '',
            user_surname: event.user_surname || event.requester_name || event.title || '',
            user_number: event.user_number || event.requester_phone || '',
            social_network_link: event.social_network_link || event.requester_email || '',
            event_notes: event.event_notes || event.description || '',
            user_id: user.id,
            type: 'customer',
            // Optional: link to event dates
            start_date: event.start_date,
            end_date: event.end_date
          };
          
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert(customerData)
            .select()
            .single();
            
          if (customerError) {
            console.error("Error creating customer from booking:", customerError);
          } else if (newCustomer && associatedFiles.length > 0) {
            console.log("Created customer from booking, now linking files");
            
            // Create file links for the customer using the new file paths
            for (const fileRecord of associatedFiles) {
              // Create customer file link using the NEW file path
              const { error: customerFileError } = await supabase
                .from('customer_files_new')
                .insert({
                  customer_id: newCustomer.id,
                  filename: fileRecord.filename,
                  file_path: fileRecord.file_path, // Use the NEW path in event_attachments
                  content_type: fileRecord.content_type,
                  size: fileRecord.size,
                  user_id: user.id
                });
                
              if (customerFileError) {
                console.error("Error creating customer file link:", customerFileError);
              } else {
                console.log("Successfully created file record for customer");
              }
            }
          }
        }
      } catch (customerError) {
        console.error("Error handling customer creation:", customerError);
      }
      
      // Send confirmation email to customer with business address
      try {
        if (event.requester_email) {
          // Fetch business profile details for the email
          const { data: businessProfile, error: profileError } = await supabase
            .from('business_profiles')
            .select('contact_address, name')
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (profileError) {
            console.error('Error fetching business address for email:', profileError);
          } else {
            console.log('Sending booking approval email with address:', businessProfile?.contact_address);
            
            const supabaseApiUrl = import.meta.env.VITE_SUPABASE_URL;
            
            await fetch(`${supabaseApiUrl}/functions/v1/send-booking-approval-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                recipientEmail: event.requester_email,
                fullName: event.requester_name || event.title || '',
                businessName: businessProfile?.name || '',
                startDate: event.start_date,
                endDate: event.end_date,
                paymentStatus: event.payment_status || 'not_paid',
                paymentAmount: event.payment_amount || 0,
                businessAddress: businessProfile?.contact_address || ''
              })
            });
          }
        }
      } catch (emailError) {
        console.error('Error sending booking approval email:', emailError);
      }
      
      // Soft-delete or update the original booking request
      try {
        const { error: updateBookingError } = await supabase
          .from('booking_requests')
          .update({ 
            status: 'approved',
            deleted_at: new Date().toISOString()  // Soft-delete the booking
          })
          .eq('id', bookingRequestId);
          
        if (updateBookingError) {
          console.error("Error updating original booking:", updateBookingError);
        }
      } catch (bookingUpdateError) {
        console.error("Error updating booking status:", bookingUpdateError);
      }
      
      return newEvent;
    }
    
    // Regular update for non-booking events or when not changing type
    const { data, error } = await supabase
      .from('events')
      .update(event)
      .eq('id', event.id)
      .select()
      .single();
      
    if (error) {
      console.error('Error updating event:', error);
      throw error;
    }
    
    return data;
  };

  const deleteEvent = async (eventId: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    // First check if this is an event created from a booking request
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('booking_request_id')
      .eq('id', eventId)
      .maybeSingle();
      
    if (fetchError) {
      console.error("Error fetching event:", fetchError);
    }
    
    // If this was created from a booking request, also update the request status
    if (event?.booking_request_id) {
      console.log("Event was created from booking request, updating request status");
      
      // Update the booking request status to rejected
      const { error: bookingError } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected', deleted_at: new Date().toISOString() })
        .eq('id', event.booking_request_id);
        
      if (bookingError) {
        console.error("Error updating booking request:", bookingError);
      }
    }
    
    // Soft delete the event
    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', eventId);
      
    if (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  };

  const eventsQuery = useQuery({
    queryKey: ['events', user?.id],
    queryFn: getEvents,
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  const businessEventsQuery = useQuery({
    queryKey: ['business-events', businessId, businessUserId],
    queryFn: getBusinessEvents,
    enabled: !!(businessId || businessUserId),
  });

  const approvedBookingsQuery = useQuery({
    queryKey: ['approved-bookings', businessId, businessUserId, user?.id],
    queryFn: getApprovedBookings,
    enabled: !!(businessId || businessUserId || user?.id),
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId, businessUserId] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId, businessUserId] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings', businessId, businessUserId] });
      toast({
        title: t("common.success"),
        description: t("events.eventUpdated"),
      });
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId, businessUserId] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings', businessId, businessUserId] });
      toast({
        title: t("common.success"),
        description: t("events.eventDeleted"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive"
      });
    },
  });

  return {
    events: eventsQuery.data || [],
    businessEvents: businessEventsQuery.data || [],
    approvedBookings: approvedBookingsQuery.data || [],
    isLoading: eventsQuery.isLoading || businessEventsQuery.isLoading || approvedBookingsQuery.isLoading,
    error: eventsQuery.error || businessEventsQuery.error || approvedBookingsQuery.error,
    createEvent: createMutation.mutateAsync,
    updateEvent: updateMutation.mutateAsync,
    deleteEvent: deleteMutation.mutateAsync,
  };
};
