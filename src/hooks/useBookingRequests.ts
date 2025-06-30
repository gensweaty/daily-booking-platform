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
  const { language } = useLanguage(); // Get current UI language
  
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
      
      // Use Map for efficient lookups, with proper typing for the nested Map
      const filesMap = new Map<string, Map<string, EventFile>>();
      
      if (filesData && filesData.length > 0) {
        console.log(`Found ${filesData.length} files for booking requests`);
        
        // Create a map of booking request ID to files with deduplication
        filesData.forEach(file => {
          if (!file.event_id) return;
          
          if (!filesMap.has(file.event_id)) {
            filesMap.set(file.event_id, new Map<string, EventFile>());
          }
          
          // Use file path as key to prevent duplicates
          const fileMap = filesMap.get(file.event_id)!;
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
  
  // Memoized function for sending emails to avoid recreating it on each render
  const sendApprovalEmail = useCallback(async ({ 
    email, 
    fullName, 
    businessName, 
    startDate, 
    endDate, 
    paymentStatus, 
    paymentAmount, 
    businessAddress,
    language,
    eventNotes
  }: {
    email: string;
    fullName: string;
    businessName: string;
    startDate: string;
    endDate: string;
    paymentStatus?: string;
    paymentAmount?: number;
    businessAddress?: string;
    language?: string;
    eventNotes?: string;
  }) => {
    if (!email || !email.includes('@')) {
      console.error("Invalid email format or missing email:", email);
      return { success: false, error: "Invalid email format" };
    }

    try {
      console.log(`🔥 SENDING EMAIL: ${email} for booking at ${businessName} with language: ${language || 'not specified'}`);
      
      // Log all data being sent in the request  
      const requestBody = {
        recipientEmail: email.trim(),
        fullName: fullName || "",
        businessName: businessName || "Our Business",
        startDate: startDate,
        endDate: endDate,
        paymentStatus: paymentStatus,
        paymentAmount: paymentAmount,
        businessAddress: businessAddress,
        language: language,
        eventNotes: eventNotes
      };
      
      console.log("📧 Email request payload:", {
        ...requestBody,
        recipientEmail: email.trim().substring(0, 3) + '***' // Mask email for privacy in logs
      });
      
      // Get access token for authenticated request
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("❌ No access token available for authenticated request");
        return { success: false, error: "Authentication error" };
      }
      
      // Call the Edge Function
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
      
      console.log(`📡 Email API response status: ${response.status}`);
      
      // Read the response as text first
      const responseText = await response.text();
      console.log(`📨 Email API response body:`, responseText);
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error("❌ Failed to parse response JSON:", e);
        if (!response.ok) {
          return { success: false, error: `Invalid response (status ${response.status})` };
        }
        return { success: true, message: "Email notification processed (response parsing error)" };
      }
      
      if (!response.ok) {
        console.error("❌ Failed to send approval email:", data);
        return { success: false, error: data.error || data.details || "Failed to send email" };
      } else {
        console.log("✅ Email API response success:", data);
        return { success: true, data };
      }
    } catch (err) {
      console.error("❌ Error calling Edge Function:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }, []);

  const approveMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      console.log('🔥 Starting approval process for booking:', bookingId);
      
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
      
      // Log the booking details including language and additional persons
      console.log('📋 Booking details for approval:', {
        id: booking.id,
        requester_name: booking.requester_name,
        requester_email: booking.requester_email,
        language: booking.language || 'not set',
        payment_status: booking.payment_status,
        user_surname: booking.user_surname,
        user_number: booking.user_number,
        social_network_link: booking.social_network_link,
        event_notes: booking.event_notes,
        additional_persons: booking.additional_persons
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
      
      // Prepare data for event creation using the save_event_with_persons function
      const eventData = {
        title: booking.title,
        start_date: booking.start_date,
        end_date: booking.end_date,
        user_surname: booking.requester_name,
        user_number: booking.requester_phone || booking.user_number || null,
        social_network_link: booking.requester_email || booking.social_network_link || null,
        event_notes: booking.description || booking.event_notes || null,
        type: 'booking_request',
        payment_status: booking.payment_status || 'not_paid',
        payment_amount: booking.payment_amount,
        language: booking.language || language
      };

      // Parse additional persons for email recipients
      let additionalPersonsFromBooking = [];
      
      // First, try to parse from additional_persons field
      if (booking.additional_persons) {
        try {
          let parsedPersons = [];
          
          if (typeof booking.additional_persons === 'string') {
            parsedPersons = JSON.parse(booking.additional_persons);
          } else if (Array.isArray(booking.additional_persons)) {
            parsedPersons = booking.additional_persons;
          }
          
          if (Array.isArray(parsedPersons)) {
            parsedPersons.forEach(person => {
              if (person && typeof person === 'object') {
                const additionalPerson = {
                  userSurname: person.userSurname || person.name || '',
                  userNumber: person.userNumber || person.phone || '',
                  socialNetworkLink: person.socialNetworkLink || person.email || '',
                  eventNotes: person.eventNotes || '',
                  paymentStatus: person.paymentStatus || booking.payment_status || 'not_paid',
                  paymentAmount: person.paymentAmount || booking.payment_amount || 0
                };
                
                if (additionalPerson.socialNetworkLink && additionalPerson.socialNetworkLink.includes('@')) {
                  additionalPersonsFromBooking.push(additionalPerson);
                  console.log('📋 Found additional person from additional_persons field:', additionalPerson);
                }
              }
            });
          }
        } catch (error) {
          console.error('Error parsing additional_persons:', error);
        }
      }
      
      // Also check legacy booking fields for additional person data
      if (booking.user_surname && booking.user_surname !== booking.requester_name && booking.social_network_link && booking.social_network_link.includes('@')) {
        const additionalPerson = {
          userSurname: booking.user_surname,
          userNumber: booking.user_number,
          socialNetworkLink: booking.social_network_link,
          eventNotes: booking.event_notes,
          paymentStatus: booking.payment_status,
          paymentAmount: booking.payment_amount
        };
        additionalPersonsFromBooking.push(additionalPerson);
        console.log('📋 Found additional person in legacy booking fields:', additionalPerson);
      }

      // Create event and customer records using the database function
      const { data: savedEventId, error: saveError } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: eventData,
          p_additional_persons: additionalPersonsFromBooking,
          p_user_id: user.id
        });
      
      if (saveError) {
        console.error('❌ Error saving event with persons:', saveError);
        throw saveError;
      }
      
      console.log('✅ Event saved with ID:', savedEventId);
      
      // Process files in parallel
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
          
          console.log('Found booking files:', bookingFiles);
            
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
                const eventFilePath = `event_${savedEventId}/${Date.now()}_${file.filename.replace(/\s+/g, '_')}`;
                
                // Upload file to event_attachments
                const { error: eventUploadError } = await supabase.storage
                  .from('event_attachments')
                  .upload(eventFilePath, fileData);
                
                if (eventUploadError) {
                  console.error('Error uploading file to event_attachments:', eventUploadError);
                } else {
                  console.log(`Successfully copied file to event_attachments/${eventFilePath}`);
                  
                  // Create event file record
                  await supabase
                    .from('event_files')
                    .insert({
                      filename: file.filename,
                      file_path: eventFilePath,
                      content_type: file.content_type,
                      size: file.size,
                      user_id: user?.id,
                      event_id: savedEventId
                    });
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
                // Generate unique paths for event attachments
                const eventFilePath = `event_${savedEventId}/${Date.now()}_${(booking.filename || 'attachment').replace(/\s+/g, '_')}`;
                
                // Upload file to event_attachments
                const { error: eventUploadError } = await supabase.storage
                  .from('event_attachments')
                  .upload(eventFilePath, fileData);
                
                if (eventUploadError) {
                  console.error('Error uploading direct file to event_attachments:', eventUploadError);
                } else {
                  console.log(`Successfully copied direct file to event_attachments/${eventFilePath}`);
                  
                  // Create event file record
                  await supabase
                    .from('event_files')
                    .insert({
                      filename: booking.filename || 'attachment',
                      file_path: eventFilePath,
                      content_type: booking.content_type || 'application/octet-stream',
                      size: booking.size || 0,
                      user_id: user?.id,
                      event_id: savedEventId
                    });
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
      
      // 🔥 EMAIL SENDING LOGIC - Complete implementation
      console.log('🔥 Starting email notifications to all attendees');
      
      if (businessProfile?.contact_address) {
        const businessName = businessProfile?.business_name || "Our Business";
        const contactAddress = businessProfile?.contact_address;
        
        // Collect all email recipients
        const emailRecipients = [];
        
        // Always include main requester
        if (booking.requester_email) {
          emailRecipients.push({
            email: booking.requester_email,
            fullName: booking.requester_name || "",
            paymentStatus: booking.payment_status,
            paymentAmount: booking.payment_amount,
            eventNotes: booking.description || booking.event_notes || null
          });
          console.log(`📧 Added main requester to email list: ${booking.requester_email}`);
        }
        
        // Add additional persons from the parsed data
        additionalPersonsFromBooking.forEach(person => {
          if (person.socialNetworkLink && person.socialNetworkLink.includes('@')) {
            emailRecipients.push({
              email: person.socialNetworkLink,
              fullName: person.userSurname || "",
              paymentStatus: person.paymentStatus || booking.payment_status,
              paymentAmount: person.paymentAmount || booking.payment_amount,
              eventNotes: person.eventNotes || booking.event_notes
            });
            console.log(`📧 Added additional person to email list: ${person.socialNetworkLink}`);
          }
        });
        
        console.log(`📬 Total email recipients: ${emailRecipients.length}`);
        console.log(`📬 Recipients list:`, emailRecipients.map(r => ({ email: r.email, name: r.fullName })));
        
        if (emailRecipients.length === 0) {
          console.warn('⚠️ No valid email recipients found for booking:', bookingId);
        } else {
          // ✅ Actually send emails to all recipients
          console.log('🔥 About to send emails to all recipients...');
          
          try {
            const emailResults = await Promise.all(
              emailRecipients.map(async (recipient, index) => {
                const emailParams = {
                  email: recipient.email,
                  fullName: recipient.fullName,
                  businessName,
                  startDate: booking.start_date,
                  endDate: booking.end_date,
                  paymentStatus: recipient.paymentStatus,
                  paymentAmount: recipient.paymentAmount,
                  businessAddress: contactAddress,
                  language: booking.language || language,
                  eventNotes: recipient.eventNotes
                };
                
                console.log(`📧 [${index + 1}/${emailRecipients.length}] Sending email to: ${recipient.email} (${recipient.fullName})`);
                
                try {
                  const emailResult = await sendApprovalEmail(emailParams);
                  if (emailResult.success) {
                    console.log(`✅ [${index + 1}/${emailRecipients.length}] Email sent successfully to ${recipient.email}`);
                  } else {
                    console.error(`❌ [${index + 1}/${emailRecipients.length}] Failed to send email to ${recipient.email}:`, emailResult.error);
                  }
                  return emailResult;
                } catch (error) {
                  console.error(`❌ [${index + 1}/${emailRecipients.length}] Exception sending email to ${recipient.email}:`, error);
                  return { success: false, error: error.message };
                }
              })
            );
            
            const successCount = emailResults.filter(r => r.success).length;
            const failCount = emailResults.filter(r => !r.success).length;
            
            console.log(`📊 Email summary: ${successCount} sent, ${failCount} failed out of ${emailRecipients.length} total`);
            
            if (failCount > 0) {
              console.warn(`⚠️ Some emails failed to send (${failCount}/${emailRecipients.length})`);
              toast({
                variant: "destructive",
                title: "Partial Email Failure",
                description: `Booking approved but ${failCount} confirmation emails failed to send.`
              });
            } else if (successCount > 0) {
              console.log(`🎉 All ${successCount} confirmation emails sent successfully!`);
            }
          } catch (error) {
            console.error('❌ Error in bulk email sending:', error);
            toast({
              variant: "destructive",
              title: "Email Error",
              description: "Booking approved but confirmation emails failed to send."
            });
          }
        }
      } else {
        console.log('⚠️ No business address configured - skipping email notifications');
        toast({
          variant: "destructive",
          title: "Email Configuration Missing",
          description: "Booking approved but no business address configured for email notifications."
        });
      }

      console.log('✅ Booking approval process completed successfully');
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
