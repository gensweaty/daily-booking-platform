
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { approveBookingRequest, rejectBookingRequest } from '@/services/bookingApprovalService';
import { clearCalendarCache } from '@/services/calendarService';

export const useBookingRequests = (businessId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchBookingRequests = async () => {
    if (!businessId) return [];

    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const {
    data: bookingRequests = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['booking-requests', businessId],
    queryFn: fetchBookingRequests,
    enabled: !!businessId,
  });

  const approveMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      return approveBookingRequest(bookingId, user.id);
    },
    onSuccess: (result, bookingId) => {
      console.log(`[useBookingRequests] Approved booking ${bookingId}, created event ${result.eventId}`);
      
      // Clear calendar cache since we created a new event
      clearCalendarCache();
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['booking-requests', businessId] });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      
      toast({
        title: "Success",
        description: "Booking request approved successfully",
      });
    },
    onError: (error: any) => {
      console.error('[useBookingRequests] Error approving booking:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve booking request",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      return rejectBookingRequest(bookingId, user.id);
    },
    onSuccess: (_, bookingId) => {
      console.log(`[useBookingRequests] Rejected booking ${bookingId}`);
      
      // Invalidate booking requests query
      queryClient.invalidateQueries({ queryKey: ['booking-requests', businessId] });
      
      toast({
        title: "Success",
        description: "Booking request rejected",
      });
    },
    onError: (error: any) => {
      console.error('[useBookingRequests] Error rejecting booking:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject booking request",
        variant: "destructive",
      });
    },
  });

  return {
    bookingRequests,
    isLoading,
    error,
    refetch,
    approveBooking: approveMutation.mutateAsync,
    rejectBooking: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
};
