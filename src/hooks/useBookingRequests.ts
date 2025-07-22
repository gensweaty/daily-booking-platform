
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { approveBookingRequest, rejectBookingRequest } from '@/services/bookingApprovalService';
import { clearCalendarCache } from '@/services/calendarService';
import { useMemo } from 'react';

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

  // Categorize booking requests by status
  const categorizedRequests = useMemo(() => {
    const pending = bookingRequests.filter(req => req.status === 'pending');
    const approved = bookingRequests.filter(req => req.status === 'approved');
    const rejected = bookingRequests.filter(req => req.status === 'rejected');
    
    return { pending, approved, rejected };
  }, [bookingRequests]);

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

  const deleteMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', bookingId);
        
      if (error) throw error;
    },
    onSuccess: (_, bookingId) => {
      console.log(`[useBookingRequests] Deleted booking ${bookingId}`);
      
      // Invalidate booking requests query
      queryClient.invalidateQueries({ queryKey: ['booking-requests', businessId] });
      
      toast({
        title: "Success",
        description: "Booking request deleted",
      });
    },
    onError: (error: any) => {
      console.error('[useBookingRequests] Error deleting booking:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking request",
        variant: "destructive",
      });
    },
  });

  return {
    bookingRequests,
    pendingRequests: categorizedRequests.pending,
    approvedRequests: categorizedRequests.approved,
    rejectedRequests: categorizedRequests.rejected,
    isLoading,
    error,
    refetch,
    approveBooking: approveMutation.mutateAsync,
    rejectBooking: rejectMutation.mutateAsync,
    approveRequest: approveMutation.mutateAsync,
    rejectRequest: rejectMutation.mutateAsync,
    deleteBookingRequest: deleteMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
};
