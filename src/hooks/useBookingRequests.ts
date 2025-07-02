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
          
          // Get the file map for this booking ID
          const fileMap = filesMap.get(bookingId)!;
          
          // Use file path as key to prevent duplicates
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
      console.log('[APPROVAL] Starting approval process for booking:', bookingId);
      
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
      
      console.log('[APPROVAL] Booking details:', {
        id: booking.id,
        requester_name: booking.requester_name,
        requester_email: booking.requester_email,
        language: booking.language || 'not set',
        payment_status: booking.payment_status
      });

      // **NEW: Validate business address before proceeding**
      const contactAddress = booking.business_address ||
                             businessProfile?.contact_address ||
                             null;

      if (!contactAddress || contactAddress.trim() === "" || contactAddress === "Address not provided") {
        console.error('[APPROVAL] Missing business address for email notification');
        toast({
          variant: "destructive",
          title: "Missing Business Address",
          description: "Please provide a valid business address in your business profile before approving bookings."
        });
        throw new Error("Missing business address for email notification");
      }

      console.log('[APPROVAL] Business address validated:', contactAddress);
      
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
      
      // Step 1: Update booking status
      console.log('[APPROVAL] Step 1: Updating booking status to approved');
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', bookingId);
      
      if (updateError) {
        console.error('[APPROVAL] Error updating booking status:', updateError);
        throw updateError;
      }
      
      // Step 2: Create event using RPC function for atomic operation
      console.log('[APPROVAL] Step 2: Creating event using RPC function');
      
      const eventData = {
        title: booking.title,
        user_surname: booking.requester_name,
        user_number: booking.requester_phone || null,
        social_network_link: booking.requester_email || null,
        event_notes: booking.description || null,
        event_name: booking.title,
        start_date: booking.start_date,
        end_date: booking.end_date,
        payment_status: booking.payment_status || 'not_paid',
        payment_amount: booking.payment_amount?.toString() || null,
        type: 'booking_request',
        is_recurring: false,
        repeat_pattern: null,
        repeat_until: null
      };
      
      const additionalPersons: any[] = [];
      
      console.log('[APPROVAL] Event data for RPC:', eventData);
      
      const { data: eventId, error: rpcError } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: eventData,
          p_additional_persons: additionalPersons,
          p_user_id: user.id,
          p_event_id: null
        });
      
      if (rpcError) {
        console.error('[APPROVAL] Error creating event via RPC:', rpcError);
        throw rpcError;
      }
      
      if (!eventId) {
        throw new Error('Failed to create event - no ID returned from RPC');
      }
      
      console.log('[APPROVAL] Event created successfully with ID:', eventId);
      
      // Step 2.5: Link the booking to the event
      console.log('[APPROVAL] Step 2.5: Linking booking to event');
      const { error: linkError } = await supabase
        .from('events')
        .update({ booking_request_id: bookingId })
        .eq('id', eventId);
      
      if (linkError) {
        console.error('[APPROVAL] Error linking booking to event:', linkError);
        // Don't throw here, as the event is created successfully
      }
      
      // Step 3: Send email notification with improved error handling
      console.log('[APPROVAL] Step 3: Sending email notification');
      
      if (booking.requester_email) {
        const businessName = businessProfile?.business_name || "Our Business";
        
        console.log('[APPROVAL] Email details:', {
          eventId: eventId,
          recipientEmail: booking.requester_email,
          businessAddress: contactAddress,
          businessName: businessName
        });
        
        try {
          const requestBody = {
            recipientEmail: booking.requester_email,
            fullName: booking.requester_name || "",
            businessName,
            startDate: booking.start_date,
            endDate: booking.end_date,
            paymentStatus: booking.payment_status || 'not_paid',
            paymentAmount: booking.payment_amount || null,
            businessAddress: contactAddress,
            eventId: eventId,
            source: 'booking-approval',
            language: booking.language || language,
            eventNotes: booking.description || '',
            // **NEW: Add force flag for admin approvals to bypass deduplication if needed**
            forceSend: false
          };

          console.log("[APPROVAL] Email request payload:", requestBody);

          const { data: emailResult, error: emailError } = await supabase.functions.invoke(
            'send-booking-approval-email',
            {
              body: requestBody
            }
          );

          if (emailError) {
            console.error("[APPROVAL] Failed to send approval email:", emailError);
            toast({
              title: "Warning",
              description: `Booking approved but email notification failed: ${emailError.message}`,
              variant: "destructive"
            });
          } else {
            console.log("[APPROVAL] Email function response:", emailResult);
            
            // **NEW: Handle different email response scenarios**
            if (emailResult?.isDuplicate) {
              console.warn("[APPROVAL] Email skipped due to deduplication");
              toast({
                title: "Booking Approved",
                description: "Booking approved successfully. Email notification was skipped (already sent previously).",
              });
            } else if (emailResult?.error) {
              console.error("[APPROVAL] Email function returned error:", emailResult.error);
              toast({
                title: "Warning",
                description: `Booking approved but email notification failed: ${emailResult.error}`,
                variant: "destructive"
              });
            } else {
              console.log("[APPROVAL] Email sent successfully:", emailResult);
              toast({
                title: "Success",
                description: "Booking approved and notification email sent successfully!",
              });
            }
          }
        } catch (emailError) {
          console.error("[APPROVAL] Error in email sending process:", emailError);
          toast({
            title: "Warning",
            description: `Booking approved but email notification failed: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`,
            variant: "destructive"
          });
        }
      } else {
        console.warn("[APPROVAL] No email address provided for notification");
        toast({
          title: "Booking Approved",
          description: "Booking approved successfully. No email notification sent (no email address provided).",
        });
      }

      // Step 4: Process files asynchronously (don't block the approval)
      console.log('[APPROVAL] Step 4: Starting file processing asynchronously');
      
      const processFiles = async () => {
        try {
          // Fetch all files from event_files linked to the booking request
          const { data: bookingFiles, error: filesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', bookingId);
            
          if (filesError) {
            console.error('[APPROVAL] Error fetching booking files:', filesError);
            return;
          }
          
          if (!bookingFiles?.length) {
            console.log('[APPROVAL] No booking files found to process for event:', bookingId);
          } else {
            console.log(`[APPROVAL] Processing ${bookingFiles.length} files for the booking in parallel`);
            
            // Process files in parallel using Promise.all
            await Promise.all(bookingFiles.map(async (file) => {
              try {
                console.log(`[APPROVAL] Processing file: ${file.filename}, path: ${file.file_path}`);
                
                // Download file from booking_attachments
                const { data: fileData, error: fileError } = await supabase.storage
                  .from('booking_attachments')
                  .download(file.file_path);
                  
                if (fileError) {
                  console.error('[APPROVAL] Error downloading file from booking_attachments:', fileError);
                  return;
                }
                
                // Generate unique path for event bucket
                const eventFilePath = `event_${eventId}/${Date.now()}_${file.filename.replace(/\s+/g, '_')}`;
                
                // Upload file to event_attachments
                const { error: uploadError } = await supabase.storage
                  .from('event_attachments')
                  .upload(eventFilePath, fileData);
                
                if (uploadError) {
                  console.error('[APPROVAL] Error uploading file to event_attachments:', uploadError);
                  return;
                }
                
                console.log(`[APPROVAL] Successfully copied file to event_attachments/${eventFilePath}`);
                
                // Create event file record with correct event ID
                await supabase
                  .from('event_files')
                  .insert({
                    filename: file.filename,
                    file_path: eventFilePath,
                    content_type: file.content_type,
                    size: file.size,
                    user_id: user?.id,
                    event_id: eventId // Use the event ID from RPC
                  });
              } catch (error) {
                console.error('[APPROVAL] Error processing file:', error);
              }
            }));
          }
          
          // Also check for direct file information in the booking_requests table
          if (booking && booking.file_path) {
            try {
              console.log(`[APPROVAL] Processing direct file from booking request: ${booking.filename || 'unnamed'}, path: ${booking.file_path}`);
              
              const { data: fileData, error: fileError } = await supabase.storage
                .from('booking_attachments')
                .download(booking.file_path);
                
              if (fileError) {
                console.error('[APPROVAL] Error downloading direct file from booking_attachments:', fileError);
                return;
              } 
              
              if (fileData) {
                // Generate unique path for event bucket
                const eventFilePath = `event_${eventId}/${Date.now()}_${(booking.filename || 'attachment').replace(/\s+/g, '_')}`;
                
                // Upload file to event_attachments
                const { error: uploadError } = await supabase.storage
                  .from('event_attachments')
                  .upload(eventFilePath, fileData);
                
                if (uploadError) {
                  console.error('[APPROVAL] Error uploading direct file to event_attachments:', uploadError);
                  return;
                }
                
                console.log(`[APPROVAL] Successfully copied direct file to event_attachments/${eventFilePath}`);
                
                // Create event file record with correct event ID
                await supabase
                  .from('event_files')
                  .insert({
                    filename: booking.filename || 'attachment',
                    file_path: eventFilePath,
                    content_type: booking.content_type || 'application/octet-stream',
                    size: booking.size || 0,
                    user_id: user?.id,
                    event_id: eventId // Use the event ID from RPC
                  });
              }
            } catch (error) {
              console.error('[APPROVAL] Error processing direct file:', error);
            }
          }
        } catch (error) {
          console.error('[APPROVAL] Error in file processing:', error);
        }
      };
      
      // Start file processing but don't wait for it to complete
      processFiles().catch(error => {
        console.error('[APPROVAL] Background file processing failed:', error);
      });

      console.log('[APPROVAL] Booking approval process completed successfully');
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
      // Note: Success toast is now handled in the mutation function based on email result
    },
    onError: (error: Error) => {
      console.error('[APPROVAL] Error in approval mutation:', error);
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
