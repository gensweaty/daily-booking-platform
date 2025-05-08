import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// Helper function to associate booking files with a new event
const associateBookingFilesWithEvent = async (
  bookingRequestId: string,
  newEventId: string,
  userId: string
) => {
  try {
    console.log(`Copying files from booking ${bookingRequestId} to event ${newEventId}`);
    
    // Fetch all files associated with the booking request
    const { data: bookingFiles, error: fetchError } = await supabase
      .from('booking_files')
      .select('*')
      .eq('booking_request_id', bookingRequestId);
      
    if (fetchError) {
      console.error("Error fetching booking files:", fetchError);
      throw fetchError;
    }
    
    if (!bookingFiles || bookingFiles.length === 0) {
      console.log("No files found for booking request:", bookingRequestId);
      return null;
    }
    
    console.log(`Found ${bookingFiles.length} files to copy`);
    
    // Copy each file to the event_files table
    const copiedFiles = [];
    for (const file of bookingFiles) {
      const { filename, file_path, content_type, size } = file;
      
      // Insert the file record into event_files
      const { data: newFile, error: copyError } = await supabase
        .from('event_files')
        .insert({
          event_id: newEventId,
          filename,
          file_path,
          content_type,
          size,
          user_id: userId,
        })
        .select()
        .single();
        
      if (copyError) {
        console.error("Error copying file to event_files:", copyError);
        continue; // Skip to the next file
      }
      
      copiedFiles.push(newFile);
      console.log(`Copied file ${filename} to event ${newEventId}`);
    }
    
    if (copiedFiles.length === 0) {
      console.log("No files were successfully copied to the event");
      return null;
    }
    
    // Return the first copied file (or adjust as needed)
    return copiedFiles[0];
  } catch (error) {
    console.error("Error associating booking files with event:", error);
    return null;
  }
};

export const useCalendarEvents = (businessId?: string, businessUserId?: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();  // Make sure we import language from context

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
    
    return originalStart !== newStart || originalEnd !== newEnd;
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

  // IMPROVED: Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // IMPROVED: Function to send confirmation email with better error handling and deduplication
  const sendBookingConfirmationEmail = async (
    eventId: string,
    title: string, 
    email: string,
    startDate: string,
    endDate: string,
    paymentStatus: string,
    paymentAmount: number | null
  ) => {
    // Optimization: Skip email sending during event creation for faster response
    // Email will be sent asynchronously after the event is created
    
    // Start email sending as a background task
    setTimeout(async () => {
      try {
        console.log(`Starting background email sending for event ${eventId} to ${email}`);
        
        // Get business address and name before anything else
        const { data: businessProfile, error: profileError } = await supabase
          .from('business_profiles')
          .select('contact_address, business_name')
          .eq('user_id', user?.id)
          .maybeSingle();
            
        if (profileError) {
          console.error('Error fetching business profile for email:', profileError);
          return false;
        }
        
        // IMPORTANT: We require a business address to send a confirmation email
        if (!businessProfile?.contact_address) {
          console.warn("No business address found. Cannot send confirmation email.");
          return false;
        }
        
        console.log('Sending booking confirmation email with info:');
        console.log(`- Address: ${businessProfile?.contact_address}`);
        console.log(`- Business name: ${businessProfile?.business_name || 'None'}`);
        console.log(`- Event ID: ${eventId}`);
        console.log(`- Recipient: ${email}`);
        
        const supabaseApiUrl = import.meta.env.VITE_SUPABASE_URL;
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        
        if (!accessToken) {
          console.error("No access token available for authenticated request");
          return false;
        }
        
        // Always include the source as "useCalendarEvents" to ensure we only use this function
        // for sending emails, avoiding duplicates from other sources
        const response = await fetch(`${supabaseApiUrl}/functions/v1/send-booking-approval-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            recipientEmail: email.trim(),
            fullName: title || '',
            businessName: businessProfile?.business_name || '',
            startDate: startDate,
            endDate: endDate,
            paymentStatus: paymentStatus || 'not_paid',
            paymentAmount: paymentAmount || 0,
            businessAddress: businessProfile?.contact_address || '',
            eventId: eventId,
            source: 'useCalendarEvents' // Updated source to ensure consistent tracking
          })
        });
        
        console.log("Email API response status:", response.status);
        
        const responseText = await response.text();
        console.log("Email API response text:", responseText);
        
        let responseData;
        try {
          responseData = responseText ? JSON.parse(responseText) : {};
          console.log("Email API parsed response:", responseData);
        } catch (jsonError) {
          console.error("Failed to parse email API response as JSON:", jsonError);
          responseData = { textResponse: responseText };
        }
        
        if (!response.ok) {
          console.error("Failed to send email notification:", responseData?.error || response.statusText);
          return false;
        }
        
        if (responseData.isDuplicate) {
          console.log("Email was identified as duplicate and not sent");
          return true; // Still return success
        } else if (responseData.skipped) {
          console.log("Email was skipped:", responseData.reason);
          return false;
        }
        
        console.log("Email notification sent successfully");
        return true;
      } catch (error) {
        console.error('Error sending booking confirmation email in background:', error);
        return false;
      }
    }, 100); // Small delay to ensure we return the event data first
    
    // Return true immediately, as we're handling the email in the background
    return true;
  };

  const createEvent = async (eventData: Partial<CalendarEventType>) => {
    try {
      // Check if we should create a customer for this event - safely access property
      const shouldCreateCustomer = eventData.shouldCreateCustomer !== false;
      const isFromCrm = !!eventData.customer_id;
      
      console.log("Creating event with data:", {
        ...eventData,
        shouldCreateCustomer,
        isFromCrm
      });
      
      // Create the event first
      const { data: event, error } = await supabase
        .from("events")
        .insert({
          title: eventData.title,
          user_surname: eventData.user_surname || eventData.title,
          user_number: eventData.user_number || "",
          social_network_link: eventData.social_network_link || "",
          event_notes: eventData.event_notes || "",
          start_date: eventData.start_date,
          end_date: eventData.end_date,
          type: eventData.type || "event",
          payment_status: eventData.payment_status || "not_paid",
          payment_amount: eventData.payment_amount,
          user_id: user.id,
          language: eventData.language || language,  // Use the language from context
          customer_id: eventData.customer_id || null  // Keep existing customer ID if set
        })
        .select()
        .single();

      if (error) throw error;
      
      // Now create a customer if needed (not from CRM and no customer ID already set)
      if (shouldCreateCustomer && !isFromCrm && event) {
        try {
          console.log("Creating customer for event:", event.id);
          
          // Create customer based on event data using correct field names
          const { data: customer, error: customerError } = await supabase
            .from("customers")
            .insert({
              // Use proper customer table field names
              title: event.user_surname || event.title,
              user_surname: event.user_surname || event.title,
              user_number: event.user_number || "",
              social_network_link: event.social_network_link || "",
              event_notes: event.event_notes || "",
              user_id: user.id,
              // Set source type based on event type
              source: "calendar",
              // Make sure to set type to match the event type
              type: event.type || "event"
            })
            .select()
            .single();
            
          if (customerError) {
            console.error("Error creating customer:", customerError);
            // Log error but don't throw to prevent event creation failure
          } else if (customer) {
            console.log("Customer created:", customer.id);
            
            // Update the event with the new customer ID
            const { error: updateError } = await supabase
              .from("events")
              .update({ customer_id: customer.id })
              .eq("id", event.id);
              
            if (updateError) {
              console.error("Error linking customer to event:", updateError);
            } else {
              console.log("Event updated with customer ID:", customer.id);
              // Update our local event object with the customer ID
              event.customer_id = customer.id;
            }
          }
        } catch (customerCreationError) {
          console.error("Exception in customer creation:", customerCreationError);
          // Don't throw to allow event creation to succeed even if customer creation fails
        }
      }

      return event;
    } catch (error) {
      console.error("Error in createEvent:", error);
      throw error;
    }
  };

  const updateEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    if (!event.id) throw new Error("Event ID is required for updates");
    
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('id, start_date, end_date, type, social_network_link')
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
      
      // Send confirmation email to customer with business address - this is the ONLY place we send emails
      if (event.requester_email && isValidEmail(event.requester_email)) {
        try {
          await sendBookingConfirmationEmail(
            newEvent.id,
            event.requester_name || event.title || '',
            event.requester_email,
            event.start_date as string,
            event.end_date as string,
            event.payment_status || 'not_paid',
            event.payment_amount || null
          );
        } catch (emailError) {
          console.error('Error sending booking approval email:', emailError);
        }
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
    
    // Send email if email address has changed
    const emailChanged = event.social_network_link && 
                        event.social_network_link !== existingEvent.social_network_link;
    
    if (emailChanged && isValidEmail(event.social_network_link as string)) {
      try {
        await sendBookingConfirmationEmail(
          data.id,
          event.title || event.user_surname || '',
          event.social_network_link as string,
          event.start_date as string,
          event.end_date as string,
          event.payment_status || 'not_paid',
          event.payment_amount || null
        );
      } catch (emailError) {
        console.error('Error sending updated booking email:', emailError);
      }
    }
    
    return data;
  };

  const deleteEvent = async (eventId: string): Promise<void> => {
    if (!user) throw new Error("User must be authenticated to delete events");
    
    // First check if this is an event created from a booking request
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('booking_request_id, payment_status, payment_amount')
      .eq('id', eventId)
      .maybeSingle();
      
    if (fetchError) {
      console.error("Error fetching event:", fetchError);
    }
    
    // Log the payment information that will be removed
    if (event?.payment_status === 'partly_paid' || event?.payment_status === 'fully_paid') {
      console.log(`Deleting event will remove payment amount ${event.payment_amount} from statistics`);
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
    
    // Invalidate all relevant queries to ensure data is refreshed
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['eventStats'] });
    queryClient.invalidateQueries({ queryKey: ['business-events'] });
    queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
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
      
      // Also invalidate statistics to reflect new event data
      queryClient.invalidateQueries({ queryKey: ['eventStats'] });
      queryClient.invalidateQueries({ queryKey: ['taskStats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
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
      
      // Also invalidate statistics to reflect updated event data
      queryClient.invalidateQueries({ queryKey: ['eventStats'] });
      
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
      
      // Explicitly invalidate statistics to ensure deleted event's income is removed
      queryClient.invalidateQueries({ queryKey: ['eventStats'] });
      
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

// Export the associateBookingFilesWithEvent function for external use
export { associateBookingFilesWithEvent };
