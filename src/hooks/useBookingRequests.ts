
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookingRequest } from "@/types/database"; // Import from database types instead of defining locally

interface UseBookingRequestsOptions {
  status?: 'pending' | 'approved' | 'rejected';
  onInitialDataLoaded?: (data: BookingRequest[]) => void;
}

export const useBookingRequests = (options?: UseBookingRequestsOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [lastNotificationCount, setLastNotificationCount] = useState(0);

  // Query booking requests filtered by status if provided
  const { data: allRequests, isLoading, error, refetch } = useQuery({
    queryKey: ['bookingRequests', options?.status],
    queryFn: async () => {
      if (!user) return [];
      
      // Get business profiles for the current user
      const { data: businessProfiles, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id);
      
      if (businessError) {
        console.error('Error fetching business profiles:', businessError);
        return [];
      }
      
      if (!businessProfiles || businessProfiles.length === 0) {
        console.log('No business profiles found for user');
        return [];
      }
      
      // Extract business IDs
      const businessIds = businessProfiles.map((profile) => profile.id);
      
      // Query booking requests for these business IDs with optional status filter
      let query = supabase
        .from('booking_requests')
        .select('*')
        .in('business_id', businessIds)
        .order('created_at', { ascending: false });
      
      if (options?.status) {
        query = query.eq('status', options.status);
      }
      
      const { data: requests, error: requestsError } = await query;
      
      if (requestsError) {
        console.error('Error fetching booking requests:', requestsError);
        return [];
      }
      
      return requests as BookingRequest[];
    },
    enabled: !!user,
  });

  // Filter requests by status for convenience
  const bookingRequests = allRequests || [];
  const pendingRequests = bookingRequests.filter(req => req.status === 'pending');
  const approvedRequests = bookingRequests.filter(req => req.status === 'approved');
  const rejectedRequests = bookingRequests.filter(req => req.status === 'rejected');
  
  // Check for new pending requests and show toast notification
  useEffect(() => {
    if (!allRequests || !options?.status || options.status !== 'pending') return;
    
    // Call the callback if provided
    if (options?.onInitialDataLoaded && allRequests) {
      options.onInitialDataLoaded(allRequests);
    }
    
    // Show notification if there are new pending requests since last check
    if (lastNotificationCount > 0 && pendingRequests.length > lastNotificationCount) {
      const newCount = pendingRequests.length - lastNotificationCount;
      
      // Use the event.newBookingRequest method with the correct translation
      toast.event.newBookingRequest(newCount);
    }
    
    // Update last count
    if (pendingRequests) {
      setLastNotificationCount(pendingRequests.length);
    }
  }, [allRequests, lastNotificationCount, options, pendingRequests]);
  
  // Function to approve a booking request
  const approveRequest = async (bookingId: string) => {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', bookingId)
        .single();
        
      if (bookingError) throw bookingError;
      
      // Update the booking request status to approved
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', bookingId);
        
      if (updateError) throw updateError;
      
      // Create an event from the booking request
      const { start_date, end_date, requester_name, requester_email, requester_phone, description, business_id } = bookingData;
      
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([
          {
            title: requester_name,
            user_surname: requester_name,
            user_number: requester_phone,
            social_network_link: requester_email,
            event_notes: description,
            start_date,
            end_date,
            type: 'event',
            payment_status: 'not_paid',
            original_booking_id: bookingId
          }
        ])
        .select()
        .single();
        
      if (eventError) throw eventError;
      
      // Send approval email
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-approval-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          bookingId,
          requesterEmail: requester_email,
          requesterName: requester_name,
          startDate: start_date,
          endDate: end_date
        })
      });
      
      // Use correct toast notification with translation
      toast.event.bookingApproved();
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      return eventData;
      
    } catch (error) {
      console.error('Error approving booking request:', error);
      toast.error({ description: t("common.errorOccurred") });
      throw error;
    }
  };
  
  // Function to reject a booking request
  const rejectRequest = async (bookingId: string) => {
    try {
      // Update the booking request status to rejected
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', bookingId);
        
      if (error) throw error;
      
      // Show success toast with translation
      toast.event.bookingRejected();
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      
    } catch (error) {
      console.error('Error rejecting booking request:', error);
      toast.error({ description: t("common.errorOccurred") });
      throw error;
    }
  };
  
  // Function to delete a booking request
  const deleteBookingRequest = async (bookingId: string) => {
    try {
      // Delete the booking request
      const { error } = await supabase
        .from('booking_requests')
        .delete()
        .eq('id', bookingId);
        
      if (error) throw error;
      
      // Show success toast with translation
      toast.event.bookingDeleted();
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      
    } catch (error) {
      console.error('Error deleting booking request:', error);
      toast.error({ description: t("common.errorOccurred") });
      throw error;
    }
  };
  
  return {
    bookingRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    isLoading,
    error,
    refetch,
    approveBookingRequest: approveRequest,
    rejectBookingRequest: rejectRequest,
    deleteBookingRequest,
    approveRequest,
    rejectRequest
  };
};
