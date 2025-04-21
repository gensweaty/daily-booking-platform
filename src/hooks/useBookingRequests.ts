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
      
      const response = await fetch(
        "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientEmail: email,
            fullName,
            businessName,
            startDate,
            endDate,
          }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Failed to send approval email:", data);
        return { success: false, error: data.error || "Failed to send email" };
      } else {
        console.log("Approval email sent successfully:", data);
        return { success: true, data };
      }
    } catch (err) {
      console.error("Error calling Edge Function:", err);
      return { success: false, error: err };
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
        
        const emailResult = await sendApprovalEmail({
          email: booking.requester_email,
          fullName: booking.requester_name || booking.user_surname || "",
          businessName,
          startDate: booking.start_date,
          endDate: booking.end_date,
        });
        
        if (emailResult.success) {
          console.log("Email sent successfully during booking approval");
        } else {
          console.error("Failed to send email during booking approval:", emailResult.error);
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
        description: "Booking request approved and notification email sent"
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
