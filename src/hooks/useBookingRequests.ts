
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
  
  // Fetch the business profile for the current user
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
  
  // Query to fetch booking requests
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
  
  // Filtered booking requests
  const pendingRequests = bookingRequests.filter(req => req.status === 'pending');
  const approvedRequests = bookingRequests.filter(req => req.status === 'approved');
  const rejectedRequests = bookingRequests.filter(req => req.status === 'rejected');
  
  // Mutation to approve a booking request
  const approveMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      // Fetch the booking request details first
      const { data: booking, error: fetchError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', bookingId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!booking) throw new Error('Booking request not found');
      
      // Check for time slot conflicts before approving
      const { data: conflictingEvents } = await supabase
        .from('events')
        .select('id, title')
        .filter('start_date', 'lt', booking.end_date)
        .filter('end_date', 'gt', booking.start_date);
      
      const { data: conflictingBookings } = await supabase
        .from('booking_requests')
        .select('id, title')
        .eq('status', 'approved')
        .not('id', 'eq', bookingId)
        .filter('start_date', 'lt', booking.end_date)
        .filter('end_date', 'gt', booking.start_date);
      
      if ((conflictingEvents && conflictingEvents.length > 0) || 
          (conflictingBookings && conflictingBookings.length > 0)) {
        throw new Error('Time slot is no longer available');
      }
      
      // Now check if this booking already has an event created for it
      // This prevents duplicate events when reapproving an already approved booking
      const { data: existingEvents } = await supabase
        .from('events')
        .select('*')
        .eq('booking_request_id', bookingId);
        
      const hasExistingEvent = existingEvents && existingEvents.length > 0;
      
      console.log(`Approving booking ${bookingId}, already has event: ${hasExistingEvent}`);
      
      // Update the booking request status to approved
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', bookingId);
      
      if (updateError) throw updateError;
      
      // Only create event if one doesn't already exist for this booking
      if (!hasExistingEvent) {
        console.log('Creating event from booking request:', booking);
        
        // Create an event record from the booking request so it appears in the internal calendar
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .insert({
            title: booking.title || booking.requester_name,
            user_surname: booking.requester_name,
            user_number: booking.requester_phone || booking.user_number,
            social_network_link: booking.requester_email || booking.social_network_link,
            event_notes: booking.event_notes || booking.description,
            start_date: booking.start_date,
            end_date: booking.end_date,
            type: 'booking_request',
            payment_status: booking.payment_status,
            payment_amount: booking.payment_amount,
            user_id: user?.id,
            booking_request_id: bookingId // Store reference to original booking
          })
          .select()
          .single();
        
        if (eventError) {
          console.error('Error creating event from booking:', eventError);
          // Revert booking approval
          await supabase
            .from('booking_requests')
            .update({ status: 'pending' })
            .eq('id', bookingId);
          throw new Error('Failed to create event from booking');
        }
        
        console.log('Created event:', eventData);
        
        // Create a customer record from the booking request for CRM
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .insert({
            title: booking.requester_name,
            user_surname: booking.requester_name,
            user_number: booking.requester_phone || booking.user_number,
            social_network_link: booking.requester_email,
            event_notes: booking.description,
            start_date: booking.start_date,
            end_date: booking.end_date,
            payment_status: booking.payment_status,
            payment_amount: booking.payment_amount,
            user_id: user?.id,
            type: 'booking_request'
          })
          .select()
          .single();
        
        if (customerError) {
          console.error('Error creating customer from booking:', customerError);
          // Continue with the approval even if customer creation fails
        } else {
          console.log('Created customer:', customerData);
        }
        
        // Check if there are any files attached to the booking
        const { data: bookingFiles } = await supabase
          .from('booking_files')
          .select('*')
          .eq('booking_id', bookingId);
          
        if (bookingFiles && bookingFiles.length > 0) {
          console.log('Found booking files to copy:', bookingFiles.length);
          
          for (const file of bookingFiles) {
            if (customerData?.id) {
              // Create customer file record
              const { error: fileError } = await supabase
                .from('customer_files_new')
                .insert({
                  filename: file.filename,
                  file_path: file.file_path,
                  content_type: file.content_type,
                  size: file.size,
                  user_id: user?.id,
                  customer_id: customerData.id
                });
                
              if (fileError) {
                console.error('Error copying booking file to customer:', fileError);
              }
            }
            
            if (eventData?.id) {
              // Create event file record
              const { error: eventFileError } = await supabase
                .from('event_files')
                .insert({
                  filename: file.filename,
                  file_path: file.file_path,
                  content_type: file.content_type,
                  size: file.size,
                  user_id: user?.id,
                  event_id: eventData.id
                });
                
              if (eventFileError) {
                console.error('Error copying booking file to event:', eventFileError);
              }
            }
          }
        }
      } else {
        console.log('Event already exists for this booking, not creating a new one');
      }
      
      return { booking };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking_requests', businessId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Success",
        description: "Booking request approved successfully and added to calendar"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve booking request",
        variant: "destructive"
      });
    }
  });
  
  // Mutation to reject a booking request
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
  
  // Mutation to delete a booking request
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
