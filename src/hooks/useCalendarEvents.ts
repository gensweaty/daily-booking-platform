import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const { t, language } = useLanguage();  // Make sure we get the current language

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
    paymentAmount: number | null,
    language: string = 'en' // Added language parameter with default value
  ) => {
    // Optimization: Skip email sending during event creation for faster response
    // Email will be sent asynchronously after the event is created
    
    // Start email sending as a background task
    setTimeout(async () => {
      try {
        console.log(`Starting background email sending for event ${eventId} to ${email} with language: ${language}`);
        
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
        console.log(`- Language: ${language}`);
        console.log(`- Payment status: ${paymentStatus}`);
        console.log(`- Payment amount: ${paymentAmount}`);
        
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
            paymentAmount: paymentAmount !== null ? parseFloat(String(paymentAmount)) : null, // Ensure proper number formatting
            businessAddress: businessProfile?.contact_address || '',
            eventId: eventId,
            source: 'useCalendarEvents', // Updated source to ensure consistent tracking
            language: language // Explicitly send language parameter
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
        
        console.log("Email notification sent successfully with currency based on language:", language);
        return true;
      } catch (error) {
        console.error('Error sending booking confirmation email in background:', error);
        return false;
      }
    }, 100); // Small delay to ensure we return the event data first
    
    // Return true immediately, as we're handling the email in the background
    return true;
  };

  const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to create events");
    
    const startDateTime = new Date(event.start_date as string);
    const endDateTime = new Date(event.end_date as string);
    
    // OPTIMIZATION: Only check availability if requested by adding a flag
    // This makes normal event creation faster but still allows for checking when needed
    if (event.checkAvailability) {
      const { available, conflictDetails } = await checkTimeSlotAvailability(
        startDateTime,
        endDateTime
      );
      
      if (!available) {
        throw new Error(`Time slot is no longer available: ${conflictDetails}`);
      }
    }
    
    // Make sure the type field is set, defaulting to 'event'
    if (!event.type) {
      event.type = 'event';
    }
    
    // Ensure title is set (title is required by the database)
    if (!event.title) {
      event.title = "Untitled Event"; // Default title if none provided
    }
    
    // Create the event - Ensure required fields are included
    const eventPayload = {
      title: event.title,
      start_date: event.start_date as string,
      end_date: event.end_date as string,
      user_id: user.id,
      type: event.type,
      // Add other optional fields
      user_surname: event.user_surname,
      user_number: event.user_number,
      social_network_link: event.social_network_link,
      event_notes: event.event_notes,
      payment_status: event.payment_status || 'not_paid',
      payment_amount: event.payment_amount,
      language: event.language || language || 'en' // Use provided language, current language, or default to 'en'
    };
    
    const { data, error } = await supabase
      .from('events')
      .insert(eventPayload)
      .select()
      .single();
      
    if (error) {
      console.error('Error creating event:', error);
      throw error;
    }
    
    // Send confirmation email in background only if we have a valid recipient email
    // and this is a new event (not from a booking request conversion)
    const recipientEmail = event.social_network_link;
    if (
      recipientEmail && 
      isValidEmail(recipientEmail) && 
      !event.id && // Check if this is a new event, not an existing one
      data
    ) {
      // Don't await this call anymore - make it run in the background
      sendBookingConfirmationEmail(
        data.id,
        event.title || event.user_surname || '',
        recipientEmail,
        event.start_date as string,
        event.end_date as string,
        event.payment_status || 'not_paid',
        event.payment_amount || null,
        event.language || language || 'en' // Use event language, current language, or default to 'en'
      );
    }
    
    return data;
  };

  const updateEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!user) throw new Error("User must be authenticated to update events");
    if (!event.id) throw new Error("Event ID is required for updates");
    
    try {
      const { data: existingEvent, error: fetchError } = await supabase
        .from('events')
        .select('id, start_date, end_date, type, social_network_link, language')
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
        
        // Make sure payment amount is properly formatted as a number if present
        let paymentAmount = null;
        if (event.payment_amount !== undefined && event.payment_amount !== null) {
          paymentAmount = parseFloat(String(event.payment_amount));
          if (isNaN(paymentAmount)) paymentAmount = null;
        }
        
        // Determine the language to use, with appropriate fallbacks
        const eventLanguage = event.language || existingEvent.language || language || 'en';
        console.log("Event language for approval:", eventLanguage);
        
        // Create a new event without direct file fields
        // We need to ensure we have all required fields for the events table
        const eventPayload: {
          title: string;
          start_date: string;
          end_date: string;
          user_id: string;
          type: string;
          user_surname?: string;
          user_number?: string;
          social_network_link?: string;
          event_notes?: string;
          payment_status?: string;
          payment_amount?: number | null;
          booking_request_id?: string;
          language?: string;
          source_url?: string;
        } = {
          // Required fields
          title: event.title || "Untitled Event", // Ensure title is never undefined
          start_date: event.start_date as string,
          end_date: event.end_date as string,
          user_id: user.id,
          type: event.type || 'event',
          
          // Optional fields
          user_surname: event.user_surname,
          user_number: event.user_number,
          social_network_link: event.social_network_link,
          event_notes: event.event_notes,
          payment_status: event.payment_status || 'not_paid',
          payment_amount: paymentAmount,
          booking_request_id: bookingRequestId,
          language: eventLanguage, // Use the determined language
        };
        
        console.log("Creating new event with payload:", {
          language: eventLanguage,
          payment_status: event.payment_status,
          payment_amount: paymentAmount
        });
        
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
        if (event.requester_email && isValidEmail(event.requester_email)) {
          try {
            console.log("Sending approval email with payment info:", {
              status: event.payment_status,
              amount: paymentAmount,
              language: eventLanguage
            });
            
            await sendBookingConfirmationEmail(
              newEvent.id,
              event.requester_name || event.title || '',
              event.requester_email,
              event.start_date as string,
              event.end_date as string,
              event.payment_status || 'not_paid',
              paymentAmount, // Use our properly formatted amount
              eventLanguage // Use the determined language
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
      
      // Process payment amount to ensure it's a valid number
      if (event.payment_amount !== undefined) {
        const numericAmount = parseFloat(String(event.payment_amount));
        if (!isNaN(numericAmount)) {
          event.payment_amount = numericAmount;
        }
      }
      
      // Make sure we preserve or update the language
      if (!event.language) {
        event.language = existingEvent.language || language || 'en';
      }
      
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
          // Make sure payment amount is properly formatted
          let paymentAmount = null;
          if (event.payment_amount !== undefined && event.payment_amount !== null) {
            paymentAmount = parseFloat(String(event.payment_amount));
            if (isNaN(paymentAmount)) paymentAmount = null;
          }
          
          // Use the event language, existing language, current app language, or default to 'en'
          const emailLanguage = event.language || existingEvent.language || language || 'en';
          
          console.log("Sending updated booking email with payment info:", {
            status: event.payment_status,
            amount: paymentAmount,
            language: emailLanguage
          });
          
          await sendBookingConfirmationEmail(
            data.id,
            event.title || event.user_surname || '',
            event.social_network_link as string,
            event.start_date as string,
            event.end_date as string,
            event.payment_status || 'not_paid',
            paymentAmount,
            emailLanguage // Use determined language
          );
        } catch (emailError) {
          console.error('Error sending updated booking email:', emailError);
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error in updateEvent:', error);
      throw error;
    }
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
        
      if (booking
