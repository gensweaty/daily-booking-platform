import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { BookingRequest } from "@/types/database";

export const useBookingRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchBusinessProfile = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching business profile:', error);
        return;
      }
      
      if (data) {
        setBusinessId(data.id);
      }
    };
    
    fetchBusinessProfile();
  }, [user]);
  
  const { data: bookingRequests = [], isLoading, error } = useQuery({
    queryKey: ['booking_requests', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });
  
  const pendingRequests = bookingRequests.filter(req => req.status === 'pending');
  const approvedRequests = bookingRequests.filter(req => req.status === 'approved');
  const rejectedRequests = bookingRequests.filter(req => req.status === 'rejected');
  
  async function sendApprovalEmail({ email, fullName, businessName, startDate, endDate }: {
    email: string;
    fullName: string;
    businessName: string;
    startDate: string;
    endDate: string;
  }) {
    if (!email || !email.includes('@')) {
      console.error("Invalid email format or missing email:", email);
      return { success: false, error: "Invalid email format" };
    }

    try {
      console.log(`Sending approval email to ${email} for booking at ${businessName}`);
      console.log(`Raw start date: ${startDate}`);
      console.log(`Raw end date: ${endDate}`);
      
      // Prepare the request with all required data - passing the original ISO strings directly
      const requestBody = JSON.stringify({
        recipientEmail: email.trim(),
        fullName: fullName || "",
        businessName: businessName || "Our Business",
        startDate: startDate, // Pass the ISO string directly
        endDate: endDate,     // Pass the ISO string directly
      });
      
      console.log("Request body for email function:", requestBody);
      
      // Get access token for authenticated request
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available for authenticated request");
        return { success: false, error: "Authentication error" };
      }
      
      // Call the Edge Function with full URL
      console.log("Making request to send-booking-approval-email function");
      const response = await fetch(
        "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: requestBody,
        }
      );

      console.log("Email function response status:", response.status);
      
      // Read the response as text first
      const responseText = await response.text();
      console.log("Email function response body:", responseText);
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
        console.log("Parsed response data:", data);
      } catch (e) {
        console.error("Failed to parse response JSON:", e);
        if (!response.ok) {
          return { success: false, error: `Invalid response (status ${response.status})` };
        }
        return { success: true, message: "Email notification processed (response parsing error)" };
      }
      
      if (!response.ok) {
        console.error("Failed to send approval email:", data);
        return { success: false, error: data.error || data.details || "Failed to send email" };
      } else {
        console.log("Approval email sent successfully:", data);
        return { success: true, data };
      }
    } catch (err) {
      console.error("Error calling Edge Function:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  const approveMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      console.log('Starting approval process for booking:', bookingId);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // Fetch the booking request first to get all details
      const { data: booking, error: fetchError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', bookingId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!booking) throw new Error('Booking request not found');
      
      console.log('Fetched booking request:', booking);
      
      // Check for conflicts
      const { data: conflictingEvents } = await supabase
        .from('events')
        .select('id, title')
        .eq('user_id', user.id)
        .filter('start_date', 'lt', booking.end_date)
        .filter('end_date', 'gt', booking.start_date)
        .is('deleted_at', null);
      
      const { data: conflictingBookings } = await supabase
        .from('booking_requests')
        .select('id, title')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .not('id', 'eq', bookingId)
        .filter('start_date', 'lt', booking.end_date)
        .filter('end_date', 'gt', booking.start_date);
      
      console.log('Conflicting events for current user:', conflictingEvents);
      console.log('Conflicting approved bookings:', conflictingBookings);
      
      if ((conflictingEvents && conflictingEvents.length > 0) || 
          (conflictingBookings && conflictingBookings.length > 0)) {
        throw new Error('Time slot is no longer available');
      }
      
      // Update the booking status to approved
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', bookingId);
      
      if (updateError) throw updateError;
      
      console.log('Booking request approved, creating event entry');
      
      // Create an event from the booking
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          title: booking.title,
          start_date: booking.start_date,
          end_date: booking.end_date,
          user_id: user.id,
          user_surname: booking.requester_name,
          user_number: booking.requester_phone || booking.user_number || null,
          social_network_link: booking.requester_email || booking.social_network_link || null,
          event_notes: booking.description || booking.event_notes || null,
          type: 'booking_request',
          booking_request_id: booking.id,
          payment_status: booking.payment_status || 'not_paid',
          payment_amount: booking.payment_amount,
          // Include file metadata if present
          file_path: booking.file_path || null,
          filename: booking.filename || null,
          content_type: booking.content_type || null,
          file_size: booking.file_size || booking.size || null
        })
        .select()
        .single();
      
      if (eventError) {
        console.error('Error creating event from booking:', eventError);
        throw eventError;
      }
      
      console.log('Created event:', eventData);
      
      // Create customer record
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert({
          title: booking.requester_name,
          user_surname: booking.user_surname || booking.requester_name || null,
          user_number: booking.requester_phone || booking.user_number || null,
          social_network_link: booking.requester_email || booking.social_network_link || null,
          event_notes: booking.description || booking.event_notes || null,
          start_date: booking.start_date,
          end_date: booking.end_date,
          user_id: user.id,
          type: 'booking_request',
          payment_status: booking.payment_status,
          payment_amount: booking.payment_amount
        })
        .select()
        .single();
      
      if (customerError) {
        console.error('Error creating customer from booking:', customerError);
        // Continue with the approval even if customer creation fails
      } else {
        console.log('Created customer:', customerData);
      }
      
      // IMPROVED FILE HANDLING: First get all files using our helper
      console.log('Fetching all booking files for booking ID:', bookingId);
      let allBookingFiles = [];
      
      try {
        // First check booking_files table directly 
        const { data: bookingFiles, error: filesError } = await supabase
          .from('booking_files')
          .select('*')
          .eq('booking_request_id', bookingId);
        
        if (filesError) {
          console.error('Error fetching booking files:', filesError);
        } else {
          console.log('Found booking files in booking_files table:', bookingFiles?.length);
          allBookingFiles = bookingFiles || [];
        }
        
        // FALLBACK: Try using the RPC function if nothing found in booking_files
        if (!allBookingFiles.length) {
          console.log('No files found in booking_files, trying get_booking_request_files RPC');
          const { data: rpcFiles, error: rpcError } = await supabase
            .rpc('get_booking_request_files', { booking_id_param: bookingId });
            
          if (rpcError) {
            console.error('Error using get_booking_request_files RPC:', rpcError);
          } else {
            console.log('Files found via RPC:', rpcFiles?.length);
            allBookingFiles = rpcFiles || [];
          }
        }

        // FINAL FALLBACK: Check booking_requests.file_path if still no files found
        if (!allBookingFiles.length && booking.file_path) {
          console.log('Fallback: Using file metadata from booking_requests:', booking.file_path);
          allBookingFiles = [{
            filename: booking.filename || 'attachment',
            file_path: booking.file_path,
            content_type: booking.content_type || 'application/octet-stream',
            size: booking.file_size || booking.size || 0
          }];
        }
          
        console.log(`Processing ${allBookingFiles.length} files for the booking`);
        
        for (const file of allBookingFiles) {
          try {
            console.log(`Processing file: ${file.filename}, path: ${file.file_path}`);
            
            // Create the event_files record pointing to the original file
            const { data: eventFileData, error: eventFileError } = await supabase
              .from('event_files')
              .insert({
                filename: file.filename,
                file_path: file.file_path, // Use the original file path
                content_type: file.content_type,
                size: file.size,
                user_id: user?.id,
                event_id: eventData.id,
                source: 'booking_request'
              })
              .select()
              .single();
            
            if (eventFileError) {
              console.error('Error creating event file record:', eventFileError);
            } else {
              console.log('Successfully created event_files record:', eventFileData);
            }
            
            // If we have a customer, also create a customer file record
            if (customerData) {
              console.log('Creating customer_files_new record with original file path');
              const { data: customerFileData, error: customerFileError } = await supabase
                .from('customer_files_new')
                .insert({
                  filename: file.filename,
                  file_path: file.file_path, // Use the original file path
                  content_type: file.content_type,
                  size: file.size,
                  user_id: user?.id,
                  customer_id: customerData.id,
                  source: 'booking_request'
                })
                .select()
                .single();
              
              if (customerFileError) {
                console.error('Error creating customer file record:', customerFileError);
              } else {
                console.log('Successfully created customer_files_new record:', customerFileData);
              }
            }
          } catch (error) {
            console.error('Error processing file:', error);
          }
        }
      } catch (fileError) {
        console.error("Error handling files during booking approval:", fileError);
      }
    
      if (booking && booking.requester_email) {
        let businessName = "Our Business";
        try {
          const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('business_name')
            .eq('id', booking.business_id)
            .maybeSingle();
          if (businessProfile && businessProfile.business_name) {
            businessName = businessProfile.business_name;
          }
        } catch (err) {
          console.warn("Could not load business profile for email:", err);
        }
        
        console.log(`Preparing to send email to ${booking.requester_email} for business ${businessName}`);
        console.log("Email data:", {
          email: booking.requester_email,
          fullName: booking.requester_name || booking.user_surname || "",
          businessName,
          startDate: booking.start_date,
          endDate: booking.end_date,
        });
        
        const emailResult = await sendApprovalEmail({
          email: booking.requester_email,
          fullName: booking.requester_name || booking.user_surname || "",
          businessName,
          startDate: booking.start_date,
          endDate: booking.end_date,
        });
        
        if (emailResult.success) {
          console.log("Email notification processed during booking approval");
        } else {
          console.error("Failed to process email during booking approval:", emailResult.error);
          // We continue even if email fails to ensure the booking is still approved
        }
      } else {
        console.warn("No email address found for booking request, can't send notification");
      }
      
      console.log('Booking approval process completed successfully');
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking_requests', businessId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      toast({
        title: "Success",
        description: "Booking request approved and notification email processed"
      });
    },
    onError: (error: Error) => {
      console.error('Error in approval mutation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve booking request",
        variant: "destructive"
      });
    }
  });
  
  const rejectMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking_requests', businessId] });
      toast({
        title: "Success",
        description: "Booking request rejected"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject booking request",
        variant: "destructive"
      });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('booking_requests')
        .delete()
        .eq('id', bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking_requests', businessId] });
      toast({
        title: "Success",
        description: "Booking request deleted"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking request",
        variant: "destructive"
      });
    }
  });
  
  return {
    bookingRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    isLoading,
    error,
    approveRequest: approveMutation.mutateAsync,
    rejectRequest: rejectMutation.mutateAsync,
    deleteBookingRequest: deleteMutation.mutateAsync,
  };
};
