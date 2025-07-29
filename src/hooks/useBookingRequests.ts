
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { checkTimeConflicts, checkBookingConflicts } from '@/utils/timeConflictChecker';
import { CalendarEventType } from '@/lib/types/calendar';
import { BookingRequest } from '@/types/database';

export const useBookingRequests = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['booking-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching booking requests:', error);
        throw error;
      }

      return data as BookingRequest[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      console.log('Approving booking request:', requestId);
      
      // Get the booking request details first
      const { data: bookingRequest, error: fetchError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) {
        console.error('Error fetching booking request:', fetchError);
        throw fetchError;
      }

      if (!bookingRequest) {
        throw new Error('Booking request not found');
      }

      // FRONTEND CONFLICT CHECK - Get existing events and bookings
      const { data: existingEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, user_id, type, deleted_at, user_surname, created_at, updated_at')
        .eq('user_id', bookingRequest.user_id)
        .is('deleted_at', null);

      if (eventsError) {
        console.error('Error fetching existing events for conflict check:', eventsError);
        throw eventsError;
      }

      // Get existing approved booking requests
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('id, title, start_date, end_date, user_id, status')
        .eq('user_id', bookingRequest.user_id)
        .eq('status', 'approved')
        .neq('id', requestId); // Exclude current booking

      if (bookingsError) {
        console.error('Error fetching existing bookings for conflict check:', bookingsError);
        throw bookingsError;
      }

      // Transform data to match CalendarEventType structure for conflict checking
      const transformedEvents = (existingEvents || []).map(event => ({
        ...event,
        created_at: event.created_at || new Date().toISOString(),
        updated_at: event.updated_at || new Date().toISOString(),
        user_id: event.user_id,
        type: event.type || 'event'
      } as CalendarEventType));

      const transformedBookings = (existingBookings || []).map(booking => ({
        id: booking.id,
        title: booking.title,
        start_date: booking.start_date,
        end_date: booking.end_date,
        type: 'booking_request'
      }));

      // Check for conflicts using our utility functions
      const eventConflicts = checkTimeConflicts(
        bookingRequest.start_date,
        bookingRequest.end_date,
        transformedEvents
      );

      const bookingConflicts = checkBookingConflicts(
        bookingRequest.start_date,
        bookingRequest.end_date,
        existingBookings || []
      );

      // If there are conflicts, prevent approval
      if (eventConflicts.hasConflicts || bookingConflicts.hasConflicts) {
        const allConflicts = [
          ...eventConflicts.conflicts,
          ...bookingConflicts.conflicts
        ];
        
        toast("Schedule Conflict", {
          description: `Cannot approve booking: conflicts with ${allConflicts.length} existing event(s). Please resolve conflicts first.`,
        });
        
        throw new Error(`Schedule conflicts detected with ${allConflicts.length} existing event(s)`);
      }

      // No conflicts, proceed with approval
      const { data, error } = await supabase
        .from('booking_requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('Error approving booking request:', error);
        throw error;
      }

      console.log('Booking request approved successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      toast("Booking Request Approved", {
        description: "The booking request has been successfully approved.",
      });
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
    onError: (error: any) => {
      toast("Error Approving Booking Request", {
        description: error.message || "Failed to approve the booking request.",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('Error rejecting booking request:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast("Booking Request Rejected", {
        description: "The booking request has been successfully rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
    onError: (error: any) => {
      toast("Error Rejecting Booking Request", {
        description: error.message || "Failed to reject the booking request.",
      });
    },
  });

    const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase
        .from('booking_requests')
        .delete()
        .eq('id', requestId)

      if (error) {
        console.error('Error deleting booking request:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast("Booking Request Deleted", {
        description: "The booking request has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
    onError: (error: any) => {
      toast("Error Deleting Booking Request", {
        description: error.message || "Failed to delete the booking request.",
      });
    },
  });

  const approvedRequestsQuery = useQuery({
    queryKey: ['approved-booking-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching approved booking requests:', error);
        throw error;
      }

      return data as BookingRequest[];
    },
  });

  // Add derived properties for backward compatibility
  const allRequests = query.data || [];
  const pendingRequests = allRequests.filter(req => req.status === 'pending');
  const rejectedRequests = allRequests.filter(req => req.status === 'rejected');
  const bookingRequests = allRequests; // alias for compatibility

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    approveBookingRequest: approveMutation.mutateAsync,
    rejectBookingRequest: rejectMutation.mutateAsync,
    cancelBookingRequest: cancelMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isCanceling: cancelMutation.isPending,
    approvedRequests: approvedRequestsQuery.data || [],
    isFetchingApprovedRequests: approvedRequestsQuery.isLoading,
    
    // Add compatibility properties
    bookingRequests,
    pendingRequests,
    rejectedRequests,
    approveRequest: approveMutation.mutateAsync,
    rejectRequest: rejectMutation.mutateAsync,
    deleteBookingRequest: cancelMutation.mutateAsync,
    refetch: query.refetch,
  };
};
