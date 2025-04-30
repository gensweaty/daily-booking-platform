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
      
      const requestBody = JSON.stringify({
        recipientEmail: email.trim(),
        fullName: fullName || "",
        businessName: businessName || "Our Business",
        startDate: startDate,
        endDate: endDate,
      });
      
      console.log("Request body for email function:", requestBody);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available for authenticated request");
        return { success: false, error: "Authentication error" };
      }
      
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
      
      const { data: booking, error: fetchError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', bookingId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!booking) throw new Error('Booking request not found');
      
      console.log('Fetched booking request:', booking);
      
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
      
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', bookingId);
      
      if (updateError) throw updateError;
      
      console.log('Booking request approved, creating event entry');
      
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
          payment_amount: booking.payment_amount
        })
        .select()
        .single();
      
      if (eventError) {
        console.error('Error creating event from booking:', eventError);
        throw eventError;
      }
      
      console.log('Created event:', eventData);
      
      // Process files from booking request to event
      // First, check if there are direct file fields in the booking_request
      let fileWasProcessed = false;
      
      if (booking.file_path && booking.filename) {
        try {
          console.log(`Processing direct file from booking_requests: ${booking.filename}, path: ${booking.file_path}`);
          
          // Download the file from booking_attachments
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('booking_attachments')
            .download(booking.file_path.startsWith('/') ? booking.file_path.substring(1) : booking.file_path);
            
          if (downloadError) {
            console.error('Error downloading file from booking_attachments:', downloadError);
          } else if (fileData) {
            // Generate a new unique file path for event_attachments
            const fileExtension = booking.filename.includes('.') ? 
              booking.filename.split('.').pop() || 'bin' : 'bin';
            
            const newFilePath = `${eventData.id}/${crypto.randomUUID()}.${fileExtension}`;
            
            console.log(`Uploading file to event_attachments/${newFilePath}`);
            
            // Upload to event_attachments
            const { error: uploadError } = await supabase.storage
              .from('event_attachments')
              .upload(newFilePath, fileData, { 
                contentType: booking.content_type || 'application/octet-stream' 
              });
              
            if (uploadError) {
              console.error('Error uploading file to event_attachments:', uploadError);
            } else {
              console.log(`Successfully copied file to event_attachments/${newFilePath}`);
              fileWasProcessed = true;
              
              // Create event_files record with the CORRECT EVENT ID
              const { data: eventFile, error: eventFileError } = await supabase
                .from('event_files')
                .insert({
                  event_id: eventData.id, // Use the new event ID, not booking ID
                  filename: booking.filename,
                  file_path: newFilePath,
                  content_type: booking.content_type || 'application/octet-stream',
                  size: booking.size || 0,
                  user_id: user.id,
                  source: 'booking_request'
                })
                .select()
                .single();
                
              if (eventFileError) {
                console.error('Error creating event file record:', eventFileError);
              } else {
                console.log('Created event file record:', eventFile);
              }
              
              // Also create a customer_files_new record for the file
              if (eventData && booking.file_path) {
                try {
                  const { data: customerData } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('title', booking.requester_name)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                    
                  if (customerData && customerData.id) {
                    const { data: customerFile, error: customerFileError } = await supabase
                      .from('customer_files_new')
                      .insert({
                        customer_id: customerData.id,
                        filename: booking.filename,
                        file_path: newFilePath, // Use the same file path as the event file
                        content_type: booking.content_type || 'application/octet-stream',
                        size: booking.size || 0,
                        user_id: user.id,
                        source: 'booking_request'
                      })
                      .select()
                      .single();
                      
                    if (customerFileError) {
                      console.error('Error creating customer file record:', customerFileError);
                    } else {
                      console.log('Created customer file record:', customerFile);
                    }
                  }
                } catch (error) {
                  console.error('Error creating customer file record:', error);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing direct booking file:', error);
        }
      }
      
      // Next, check if there are any files in event_files table with booking ID as event_id
      const { data: existingFiles, error: existingFilesError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', bookingId);
        
      if (existingFilesError) {
        console.error('Error fetching existing booking files:', existingFilesError);
      } else if (existingFiles && existingFiles.length > 0) {
        fileWasProcessed = true;
        console.log(`Found ${existingFiles.length} files in event_files with booking ID ${bookingId}`);
        
        // Process each file by copying it to the new event
        for (const file of existingFiles) {
          try {
            console.log(`Processing existing file: ${file.filename}, path: ${file.file_path}`);
            
            // Create new event_files record for the new event
            const { data: newEventFile, error: newEventFileError } = await supabase
              .from('event_files')
              .insert({
                event_id: eventData.id,
                filename: file.filename,
                file_path: file.file_path,
                content_type: file.content_type || 'application/octet-stream',
                size: file.size || 0,
                user_id: user.id,
                source: 'booking_request'
              })
              .select()
              .single();
              
            if (newEventFileError) {
              console.error('Error creating event file record:', newEventFileError);
            } else {
              console.log(`Created new event file record for ${file.filename}`);
            }
            
            // Also create a customer_files_new record for the file
            if (eventData) {
              try {
                const { data: customerData } = await supabase
                  .from('customers')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('title', booking.requester_name)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                  
                if (customerData && customerData.id) {
                  const { data: customerFile, error: customerFileError } = await supabase
                    .from('customer_files_new')
                    .insert({
                      customer_id: customerData.id,
                      filename: file.filename,
                      file_path: file.file_path,
                      content_type: file.content_type || 'application/octet-stream',
                      size: file.size || 0,
                      user_id: user.id,
                      source: 'booking_request'
                    })
                    .select()
                    .single();
                    
                  if (customerFileError) {
                    console.error('Error creating customer file record:', customerFileError);
                  } else {
                    console.log('Created customer file record:', customerFile);
                  }
                }
              } catch (error) {
                console.error('Error creating customer file record:', error);
              }
            }
          } catch (error) {
            console.error('Error processing existing file:', error);
          }
        }
      }
      
      // If no files were processed yet, try to retrieve files from RPC function
      if (!fileWasProcessed) {
        const { data: filesFromRpc, error: filesError } = await supabase
          .rpc('get_booking_request_files', { booking_id_param: booking.id });
          
        if (filesError) {
          console.error('Error fetching booking files using RPC:', filesError);
        } else if (filesFromRpc && filesFromRpc.length > 0) {
          console.log(`Found ${filesFromRpc.length} files via RPC for booking ${booking.id}`);
          fileWasProcessed = true;
          
          for (const file of filesFromRpc) {
            try {
              // Create new event_files record for the new event
              const { data: newEventFile, error: newEventFileError } = await supabase
                .from('event_files')
                .insert({
                  event_id: eventData.id,
                  filename: file.filename,
                  file_path: file.file_path,
                  content_type: file.content_type || 'application/octet-stream',
                  size: file.size || 0,
                  user_id: user.id,
                  source: 'booking_request'
                })
                .select()
                .single();
                
              if (newEventFileError) {
                console.error('Error creating event file record from RPC:', newEventFileError);
              } else {
                console.log(`Created new event file record for ${file.filename} from RPC`);
              }
            } catch (error) {
              console.error('Error processing RPC file:', error);
            }
          }
        }
      }
      
      // Email notification portion
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
