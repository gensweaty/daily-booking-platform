import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { checkTimeConflicts, checkBookingConflicts } from '@/utils/timeConflictChecker';
import { CalendarEventType } from '@/lib/types/calendar';

interface BookingRequest {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

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
        .select('id, title, start_date, end_date, user_id, type, deleted_at, user_surname')
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

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
        
        toast({
          title: "Schedule Conflict",
          description: `Cannot approve booking: conflicts with ${allConflicts.length} existing event(s). Please resolve conflicts first.`,
          variant: "destructive",
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
      toast({
        title: "Booking Request Approved",
        description: "The booking request has been successfully approved.",
      });
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Approving Booking Request",
        description: error.message || "Failed to approve the booking request.",
        variant: "destructive",
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
      toast({
        title: "Booking Request Rejected",
        description: "The booking request has been successfully rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Rejecting Booking Request",
        description: error.message || "Failed to reject the booking request.",
        variant: "destructive",
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
      toast({
        title: "Booking Request Deleted",
        description: "The booking request has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Booking Request",
        description: error.message || "Failed to delete the booking request.",
        variant: "destructive",
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

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    approveBookingRequest: approveMutation.mutateAsync,
    rejectBookingRequest: rejectMutation.mutateAsync,
    cancelBookingRequest: cancelMutation.mutateAsync,
    isApproving: approveMutation.isLoading,
    isRejecting: rejectMutation.isLoading,
    isCanceling: cancelMutation.isLoading,
    approvedRequests: approvedRequestsQuery.data || [],
    isFetchingApprovedRequests: approvedRequestsQuery.isLoading,
  };
};
