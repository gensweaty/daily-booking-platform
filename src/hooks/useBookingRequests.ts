
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
  
  const { data: bookingRequestsData = [], isLoading, error } = useQuery({
    queryKey: ['booking_requests', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      console.log('Fetching booking requests with files for business_id:', businessId);
      
      // Fetch booking requests
      const { data: requests, error: requestsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      
      if (requestsError) {
        console.error('Error fetching booking requests:', requestsError);
        throw requestsError;
      }
      
      if (!requests || requests.length === 0) {
        console.log('No booking requests found');
        return [];
      }
      
      console.log(`Found ${requests.length} booking requests`);
      
      // Fetch files for all booking requests using event_files table
      // Files for booking requests are stored with event_id matching the booking request ID
      const requestIds = requests.map(req => req.id);
      
      const { data: filesData, error: filesError } = await supabase
        .from('event_files')
        .select('*')
        .in('event_id', requestIds);
      
      if (filesError) {
        console.error('Error fetching booking request files:', filesError);
        // Don't throw here, just proceed without files
      }
      
      const filesMap = new Map();
      
      if (filesData && filesData.length > 0) {
        console.log(`Found ${filesData.length} files for booking requests`);
        
        // Create a map of booking request ID to files
        filesData.forEach(file => {
          if (!filesMap.has(file.event_id)) {
            filesMap.set(file.event_id, []);
          }
          filesMap.get(file.event_id).push(file);
        });
      } else {
        console.log('No files found for booking requests');
      }
      
      // Enrich requests with files information
      return requests.map(request => {
        const files = filesMap.get(request.id) || [];
        
        // If we have files, add the first file's info directly to the request object
        // This maintains compatibility with the existing UI
        if (files.length > 0) {
          const firstFile = files[0];
          return {
            ...request,
            filename: firstFile.filename,
            file_path: firstFile.file_path,
            content_type: firstFile.content_type,
            size: firstFile.size,
            files: files // Add all files array for future use if needed
          };
        }
        
        return request;
      });
    },
    enabled: !!businessId,
  });
  
  // Extract the booking requests from the data
  const bookingRequests = bookingRequestsData || [];
  
  // Filter requests by status
  const pendingRequests = bookingRequests.filter(req => req.status === 'pending');
  const approvedRequests = bookingRequests.filter(req => req.status === 'approved');
  const rejectedRequests = bookingRequests.filter(req => req.status === 'rejected');
  
  async function sendApprovalEmail({ email, fullName, businessName, startDate, endDate, paymentStatus, paymentAmount, businessAddress }: {
    email: string;
    fullName: string;
    businessName: string;
    startDate: string;
    endDate: string;
    paymentStatus?: string;
    paymentAmount?: number;
    businessAddress?: string;
  }) {
    if (!email || !email.includes('@')) {
      console.error("Invalid email format or missing email:", email);
      return { success: false, error: "Invalid email format" };
    }

    try {
      console.log(`Sending approval email to ${email} for booking at ${businessName}`);
      console.log(`Raw start date: ${startDate}`);
      console.log(`Raw end date: ${endDate}`);
      
      // ENHANCED LOGGING - For debugging the exact address value
      console.log(`Email data details - DEBUGGING ADDRESS ISSUE:`);
      console.log(`- Business address (raw): "${businessAddress}"`);
      console.log(`- Business address type: ${typeof businessAddress}`);
      console.log(`- Is address null? ${businessAddress === null}`);
      console.log(`- Is address undefined? ${businessAddress === undefined}`);
      if (businessAddress) {
        console.log(`- Address length: ${businessAddress.length}`);
        console.log(`- First 20 chars: "${businessAddress.substring(0, 20)}"`);
      }
      
      // Log all data being sent in the request
      const requestBody = {
        recipientEmail: email.trim(),
        fullName: fullName || "",
        businessName: businessName || "Our Business",
        startDate: startDate,
        endDate: endDate,
        paymentStatus: paymentStatus,
        paymentAmount: paymentAmount,
        businessAddress: businessAddress // Pass the address as is
      };
      
      console.log("Complete request body for email function:", JSON.stringify(requestBody, null, 2));
      
      // Get access token for authenticated request
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available for authenticated request");
        return { success: false, error: "Authentication error" };
      }
      
      // Call the Edge Function
      console.log("Making request to send-booking-approval-email function");
      const response = await fetch(
        "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log("Email API response status:", response.status);
      
      // Read the response as text first
      const responseText = await response.text();
      console.log("Email API response text:", responseText);
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
        console.log("Email API parsed response:", data);
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
        console.log("Email API response success:", data);
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
      
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert({
          title: booking.requester_name,
          user_surname: booking.user_surname || null,
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
      
      // Improved file handling: Fetch all files from event_files linked to the booking request
      const { data: bookingFiles, error: filesError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', bookingId);
        
      if (filesError) {
        console.error('Error fetching booking files:', filesError);
      }
      
      console.log('Found booking files:', bookingFiles);
        
      if (bookingFiles && bookingFiles.length > 0) {
        console.log(`Processing ${bookingFiles.length} files for the booking`);
        
        for (const file of bookingFiles) {
          try {
            console.log(`Processing file: ${file.filename}, path: ${file.file_path}`);
            
            const { data: fileData, error: fileError } = await supabase.storage
              .from('booking_attachments')
              .download(file.file_path);
              
            if (fileError) {
              console.error('Error downloading file from booking_attachments:', fileError);
              continue;
            }
            
            const newFilePath = `${Date.now()}_${file.filename.replace(/\s+/g, '_')}`;
            const { error: uploadError } = await supabase.storage
              .from('event_attachments')
              .upload(newFilePath, fileData);
              
            if (uploadError) {
              console.error('Error uploading file to event_attachments:', uploadError);
              continue;
            }
            
            console.log(`Successfully copied file to event_attachments/${newFilePath}`);
            
            // Create file record in event_files for the newly created event
            const { error: eventFileError } = await supabase
              .from('event_files')
              .insert({
                filename: file.filename,
                file_path: newFilePath,
                content_type: file.content_type,
                size: file.size,
                user_id: user?.id,
                event_id: eventData.id
              });
              
            if (eventFileError) {
              console.error('Error creating event file record:', eventFileError);
            } else {
              console.log('Successfully created event file record');
            }
            
            if (customerData) {
              const { error: customerFileError } = await supabase
                .from('customer_files_new')
                .insert({
                  filename: file.filename,
                  file_path: newFilePath,
                  content_type: file.content_type,
                  size: file.size,
                  user_id: user?.id,
                  customer_id: customerData.id
                });
                
              if (customerFileError) {
                console.error('Error creating customer file record:', customerFileError);
              }
            }
          } catch (error) {
            console.error('Error processing file:', error);
          }
        }
      }
      
      // Also check for direct file information in the booking_requests table
      if (booking && booking.file_path) {
        try {
          console.log(`Processing direct file from booking request: ${booking.filename || 'unnamed'}, path: ${booking.file_path}`);
          
          const { data: fileData, error: fileError } = await supabase.storage
            .from('booking_attachments')
            .download(booking.file_path);
            
          if (fileError) {
            console.error('Error downloading direct file from booking_attachments:', fileError);
          } else if (fileData) {
            const newFilePath = `${Date.now()}_${(booking.filename || 'attachment').replace(/\s+/g, '_')}`;
            const { error: uploadError } = await supabase.storage
              .from('event_attachments')
              .upload(newFilePath, fileData);
              
            if (uploadError) {
              console.error('Error uploading direct file to event_attachments:', uploadError);
            } else {
              console.log(`Successfully copied direct file to event_attachments/${newFilePath}`);
              
              // Create file record in event_files for the newly created event
              const { error: eventFileError } = await supabase
                .from('event_files')
                .insert({
                  filename: booking.filename || 'attachment',
                  file_path: newFilePath,
                  content_type: booking.content_type || 'application/octet-stream',
                  size: booking.size || 0,
                  user_id: user?.id,
                  event_id: eventData.id
                });
                
              if (eventFileError) {
                console.error('Error creating event file record for direct file:', eventFileError);
              } else {
                console.log('Successfully created event file record for direct file');
              }
              
              if (customerData) {
                const { error: customerFileError } = await supabase
                  .from('customer_files_new')
                  .insert({
                    filename: booking.filename || 'attachment',
                    file_path: newFilePath,
                    content_type: booking.content_type || 'application/octet-stream',
                    size: booking.size || 0,
                    user_id: user?.id,
                    customer_id: customerData.id
                  });
                  
                if (customerFileError) {
                  console.error('Error creating customer file record for direct file:', customerFileError);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing direct file:', error);
        }
      }
      
      // CRITICAL FIX: Fetch business information INCLUDING address before sending email
      let businessName = "Our Business";
      let contactAddress = null;
      
      try {
        // Fetch business profile with name AND address
        const { data: businessProfile, error: profileError } = await supabase
          .from('business_profiles')
          .select('business_name, contact_address')
          .eq('id', booking.business_id)
          .single();
        
        if (profileError) {
          console.error('Error fetching business profile for email:', profileError);
        }
          
        if (businessProfile) {
          businessName = businessProfile.business_name || businessName;
          contactAddress = businessProfile.contact_address || null;
          
          // ENHANCED DEBUGGING - Log business profile with special attention to address
          console.log("Fetched business profile details for email:");
          console.log("- Business name:", businessName);
          console.log("- Contact address (raw):", JSON.stringify(contactAddress));
          console.log("- Contact address (direct):", contactAddress);
          console.log("- Address type:", typeof contactAddress);
          
          if (contactAddress === null) {
            console.log("WARNING: Contact address is NULL in database");
          } else if (contactAddress === undefined) {
            console.log("WARNING: Contact address is UNDEFINED in database");
          } else if (typeof contactAddress === 'string' && contactAddress.trim() === '') {
            console.log("WARNING: Contact address is an EMPTY STRING in database");
          }
        }
      } catch (err) {
        console.error("Could not load business profile details for email:", err);
      }
      
      console.log(`Preparing to send email to ${booking.requester_email} for business ${businessName}`);
      
      if (booking && booking.requester_email) {
        // Send the approval email, passing the business address we just fetched
        // DIRECT ADDRESS PASS - Stringify the entire email parameters for debugging
        const emailParams = {
          email: booking.requester_email,
          fullName: booking.requester_name || booking.user_surname || "",
          businessName,
          startDate: booking.start_date,
          endDate: booking.end_date,
          paymentStatus: booking.payment_status,
          paymentAmount: booking.payment_amount,
          businessAddress: contactAddress // Pass the address directly
        };
        
        console.log("Final email parameters being sent:", JSON.stringify(emailParams, null, 2));
        
        const emailResult = await sendApprovalEmail(emailParams);
        
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
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "bookings.requestApproved"
        }
      });
    },
    onError: (error: Error) => {
      console.error('Error in approval mutation:', error);
      toast({
        variant: "destructive",
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        },
        description: error.message || "Failed to approve booking request"
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
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "bookings.requestRejected"
        }
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        },
        description: error.message || "Failed to reject booking request"
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
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "bookings.requestDeleted"
        }
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        },
        description: error.message || "Failed to delete booking request"
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
