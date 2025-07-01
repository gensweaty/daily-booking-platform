import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { BookingRequest, EventFile } from "@/types/database";
import { useLanguage } from "@/contexts/LanguageContext";

export const useBookingRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<{
    business_name: string;
    contact_address: string | null;
  } | null>(null);
  const { language } = useLanguage();
  
  // Cache business profile data when component mounts
  useEffect(() => {
    const fetchBusinessProfile = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('business_profiles')
        .select('id, business_name, contact_address')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching business profile:', error);
        return;
      }
      
      if (data) {
        setBusinessId(data.id);
        setBusinessProfile({
          business_name: data.business_name || 'Our Business',
          contact_address: data.contact_address || null
        });
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
      
      // Fetch files for all booking requests
      // First, get events linked to these booking requests to get correct event IDs
      const requestIds = requests.map(req => req.id);
      
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, booking_request_id')
        .in('booking_request_id', requestIds);
      
      if (eventsError) {
        console.error('Error fetching events for booking requests:', eventsError);
      }
      
      // Map booking_request_id to event.id
      const bookingToEventIdMap = new Map<string, string>();
      events?.forEach(e => {
        if (e.booking_request_id) {
          bookingToEventIdMap.set(e.booking_request_id, e.id);
        }
      });
      
      // Fetch files using both booking request IDs (for pending) and event IDs (for approved)
      const eventIds = Array.from(bookingToEventIdMap.values());
      const allSearchIds = [...requestIds, ...eventIds];
      
      const { data: filesData, error: filesError } = await supabase
        .from('event_files')
        .select('*')
        .in('event_id', allSearchIds);
      
      if (filesError) {
        console.error('Error fetching booking request files:', filesError);
        // Don't throw here, just proceed without files
      }
      
      // Use Map for efficient lookups, with proper typing for the nested Map
      const filesMap = new Map<string, Map<string, EventFile>>();
      
      if (filesData && filesData.length > 0) {
        console.log(`Found ${filesData.length} files for booking requests`);
        
        // Create a map of booking request ID to files with deduplication
        filesData.forEach(file => {
          if (!file.event_id) return;
          
          // Determine the booking request ID for this file
          let bookingId = file.event_id;
          
          // If this is an event ID, map it back to booking request ID
          const foundBookingId = Array.from(bookingToEventIdMap.entries())
            .find(([, eventId]) => eventId === file.event_id)?.[0];
          if (foundBookingId) {
            bookingId = foundBookingId;
          }
          
          if (!filesMap.has(bookingId)) {
            filesMap.set(bookingId, new Map<string, EventFile>());
          }
          
          // Use file path as key to prevent duplicates
          const fileMap = filesMap.get(bookingId)!;
          const fileKey = `${file.filename}:${file.file_path}`;
          
          if (!fileMap.has(fileKey)) {
            fileMap.set(fileKey, file);
          }
        });
      } else {
        console.log('No files found for booking requests');
      }
      
      // Enrich requests with files information
      return requests.map(request => {
        // Get deduplicated files from the map
        const fileMap = filesMap.get(request.id);
        const files = fileMap ? Array.from(fileMap.values()) : [];
        
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
      
      // Log the booking details including language
      console.log('Booking details for approval:', {
        id: booking.id,
        requester_name: booking.requester_name,
        requester_email: booking.requester_email,
        language: booking.language || 'not set',
        payment_status: booking.payment_status
      });
      
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
      
      if ((conflictingEvents && conflictingEvents.length > 0) || 
          (conflictingBookings && conflictingBookings.length > 0)) {
        throw new Error('Time slot is no longer available');
      }
      
      // Use transaction to update booking status
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', bookingId);
      
      if (updateError) throw updateError;
      
      // Prepare data for event and customer creation
      const eventData = {
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
        language: booking.language || language // Preserve the booking's original language or use UI language
      };
      
      const customerData = {
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
      };
      
      // Create event and customer records in parallel
      const [eventResult, customerResult] = await Promise.all([
        supabase.from('events').insert(eventData).select().single(),
        supabase.from('customers').insert(customerData).select().single()
      ]);
      
      if (eventResult.error) {
        console.error('Error creating event from booking:', eventResult.error);
        throw eventResult.error;
      }
      
      if (customerResult.error) {
        console.error('Error creating customer from booking:', customerResult.error);
        // Continue with the approval even if customer creation fails
      }
      
      const eventData2 = eventResult.data;
      const customerData2 = customerResult.data;
      
      // Process files in parallel instead of sequentially
      const processFiles = async () => {
        try {
          // Fetch all files from event_files linked to the booking request
          const { data: bookingFiles, error: filesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', bookingId);
            
          if (filesError) {
            console.error('Error fetching booking files:', filesError);
            return;
          }
          
          if (!bookingFiles?.length) {
            console.warn('No booking files found to process for event:', bookingId);
          } else {
            console.log('Found booking files:', bookingFiles);
          }
            
          if (bookingFiles && bookingFiles.length > 0) {
            console.log(`Processing ${bookingFiles.length} files for the booking in parallel`);
            
            // Process files in parallel using Promise.all
            await Promise.all(bookingFiles.map(async (file) => {
              try {
                console.log(`Processing file: ${file.filename}, path: ${file.file_path}`);
                
                // Download file from booking_attachments
                const { data: fileData, error: fileError } = await supabase.storage
                  .from('booking_attachments')
                  .download(file.file_path);
                  
                if (fileError) {
                  console.error('Error downloading file from booking_attachments:', fileError);
                  return;
                }
                
                // Generate unique paths for both buckets to avoid conflicts
                const eventFilePath = `event_${eventData2.id}/${Date.now()}_${file.filename.replace(/\s+/g, '_')}`;
                const customerFilePath = customerData2 ? `customer_${customerData2.id}/${Date.now()}_${file.filename.replace(/\s+/g, '_')}` : null;
                
                // Upload files in parallel
                const [eventUpload, customerUpload] = await Promise.all([
                  supabase.storage
                    .from('event_attachments')
                    .upload(eventFilePath, fileData),
                  customerFilePath ? 
                    supabase.storage
                      .from('customer_attachments')
                      .upload(customerFilePath, fileData) : 
                    Promise.resolve({ error: null })
                ]);
                
                // Check for upload errors and handle them
                if (eventUpload.error) {
                  console.error('Error uploading file to event_attachments:', eventUpload.error);
                  throw new Error(`Event storage upload failed: ${eventUpload.error.message}`);
                } else {
                  console.log(`Successfully copied file to event_attachments/${eventFilePath}`);
                  
                  // Create event file record with correct event ID
                  await supabase
                    .from('event_files')
                    .insert({
                      filename: file.filename,
                      file_path: eventFilePath,
                      content_type: file.content_type,
                      size: file.size,
                      user_id: user?.id,
                      event_id: eventData2.id // Use the new event ID, not booking ID
                    });
                }
                
                // Only upload to customer_attachments if we successfully created a customer and the upload succeeded
                if (customerData2 && !customerUpload.error && customerFilePath) {
                  console.log(`Successfully copied file to customer_attachments/${customerFilePath}`);
                  
                  // Create customer file record
                  await supabase
                    .from('customer_files_new')
                    .insert({
                      filename: file.filename,
                      file_path: customerFilePath,
                      content_type: file.content_type,
                      size: file.size,
                      user_id: user?.id,
                      customer_id: customerData2.id
                    });
                } else if (customerUpload.error) {
                  console.error('Error uploading file to customer_attachments:', customerUpload.error);
                }
              } catch (error) {
                console.error('Error processing file:', error);
              }
            }));
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
                return;
              } 
              
              if (fileData) {
                // Generate unique paths for both buckets to avoid conflicts
                const eventFilePath = `event_${eventData2.id}/${Date.now()}_${(booking.filename || 'attachment').replace(/\s+/g, '_')}`;
                const customerFilePath = customerData2 ? `customer_${customerData2.id}/${Date.now()}_${(booking.filename || 'attachment').replace(/\s+/g, '_')}` : null;
                
                // Upload files in parallel
                const [eventUpload, customerUpload] = await Promise.all([
                  supabase.storage
                    .from('event_attachments')
                    .upload(eventFilePath, fileData),
                  customerFilePath ?
                    supabase.storage
                      .from('customer_attachments')
                      .upload(customerFilePath, fileData) :
                    Promise.resolve({ error: null })
                ]);
                
                // Check for upload errors
                if (eventUpload.error) {
                  console.error('Error uploading direct file to event_attachments:', eventUpload.error);
                  throw new Error(`Event storage upload failed: ${eventUpload.error.message}`);
                } else {
                  console.log(`Successfully copied direct file to event_attachments/${eventFilePath}`);
                  
                  // Create event file record with correct event ID
                  await supabase
                    .from('event_files')
                    .insert({
                      filename: booking.filename || 'attachment',
                      file_path: eventFilePath,
                      content_type: booking.content_type || 'application/octet-stream',
                      size: booking.size || 0,
                      user_id: user?.id,
                      event_id: eventData2.id // Use the new event ID, not booking ID
                    });
                }
                
                // Only upload to customer_attachments if we successfully created a customer and the upload succeeded
                if (customerData2 && !customerUpload.error && customerFilePath) {
                  console.log(`Successfully copied direct file to customer_attachments/${customerFilePath}`);
                  
                  // Create customer file record
                  await supabase
                    .from('customer_files_new')
                    .insert({
                      filename: booking.filename || 'attachment',
                      file_path: customerFilePath,
                      content_type: booking.content_type || 'application/octet-stream',
                      size: booking.size || 0,
                      user_id: user?.id,
                      customer_id: customerData2.id
                    });
                } else if (customerUpload.error) {
                  console.error('Error uploading direct file to customer_attachments:', customerUpload.error);
                }
              }
            } catch (error) {
              console.error('Error processing direct file:', error);
            }
          }
        } catch (error) {
          console.error('Error in file processing:', error);
        }
      };
      
      // Start file processing but don't wait for it to complete
      const fileProcessingPromise = processFiles();
      
      // Send email notification AFTER event creation using correct event ID
      if (booking.requester_email) {
        // Get business address with multiple fallbacks
        const contactAddress = booking.business_address || 
                             businessProfile?.contact_address || 
                             "Address not provided";
        
        const businessName = businessProfile?.business_name || "Our Business";
        
        console.log('Sending approval email with correct event ID:', eventData2.id);
        console.log('Requester email:', booking.requester_email);
        console.log('Business address:', contactAddress);
        
        // Determine the correct base URL based on environment
        const baseUrl = import.meta.env.DEV 
          ? 'http://localhost:54321'
          : 'https://mrueqpffzauvdxmuwhfa.supabase.co';
        
        const functionUrl = `${baseUrl}/functions/v1/send-booking-approval-email`;
        
        // Use direct Edge Function call for reliable email sending
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const accessToken = session?.access_token;

          if (!accessToken) {
            console.error('No access token available for email sending');
            return booking;
          }

          console.log("Sending email via:", functionUrl);
          console.log("Access Token exists:", !!accessToken);

          const requestBody = {
            recipientEmail: booking.requester_email,
            fullName: booking.requester_name || booking.user_surname || "",
            businessName,
            startDate: booking.start_date,
            endDate: booking.end_date,
            paymentStatus: booking.payment_status || 'not_paid',
            paymentAmount: booking.payment_amount || null,
            businessAddress: contactAddress,
            eventId: eventData2.id, // Use the actual event ID for proper deduplication
            source: 'booking-approval',
            language: booking.language || language,
            eventNotes: booking.description || booking.event_notes || ''
          };

          console.log("Request payload:", requestBody);

          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          console.log("Response status:", response.status);
          const emailResult = await response.json();
          console.log("Email result:", emailResult);
          
          if (!response.ok) {
            console.error("Failed to send approval email:", emailResult);
            throw new Error(emailResult.error || 'Failed to send email');
          } else {
            console.log("Approval email sent successfully");
          }
        } catch (emailError) {
          console.error("Error sending approval email:", emailError);
        }
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
