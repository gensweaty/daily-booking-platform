
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BookingRequest } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { clearCalendarCache } from '@/services/calendarService';
import { useEffect, useMemo } from 'react';

export const useBookingRequests = (businessId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['booking-requests', businessId];

  const fetchBookingRequests = async (): Promise<BookingRequest[]> => {
    if (!businessId) {
      console.warn("[useBookingRequests] No business ID provided, skipping fetch.");
      return [];
    }

    console.log(`[useBookingRequests] Fetching booking requests for business: ${businessId}`);

    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[useBookingRequests] Error fetching booking requests:", error);
      throw error;
    }

    console.log(`[useBookingRequests] ✅ Loaded ${data?.length || 0} booking requests.`);
    // Cast status to proper type to fix TypeScript error
    return (data || []).map(item => ({
      ...item,
      status: item.status as 'pending' | 'approved' | 'rejected'
    }));
  };

  const {
    data: bookingRequests = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: fetchBookingRequests,
    enabled: !!businessId,
    staleTime: 0,
    gcTime: 3000,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Compute filtered arrays using useMemo for performance
  const filteredRequests = useMemo(() => {
    const pending = bookingRequests.filter(req => req.status === 'pending');
    const approved = bookingRequests.filter(req => req.status === 'approved');
    const rejected = bookingRequests.filter(req => req.status === 'rejected');

    return { pending, approved, rejected };
  }, [bookingRequests]);

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const debouncedInvalidate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
        refetch();
      }, 100);
    };

    const handleCacheInvalidation = () => {
      console.log('[useBookingRequests] Cache invalidation detected, refetching...');
      debouncedInvalidate();
    };

    const handleBookingUpdate = (event: CustomEvent) => {
      console.log('[useBookingRequests] Booking update detected:', event.detail);
      debouncedInvalidate();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'calendar_invalidation_signal' || event.key === 'booking-request-updated') {
        console.log('[useBookingRequests] Cross-tab sync detected, refetching...');
        debouncedInvalidate();
      }
    };

    window.addEventListener('calendar-cache-invalidated', handleCacheInvalidation);
    window.addEventListener('booking-request-updated', handleBookingUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('calendar-cache-invalidated', handleCacheInvalidation);
      window.removeEventListener('booking-request-updated', handleBookingUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [queryClient, queryKey, refetch]);

  useEffect(() => {
    if (!businessId) return;

    console.log('[useBookingRequests] Setting up real-time subscription');

    let debounceTimer: NodeJS.Timeout;

    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        clearCalendarCache();
        queryClient.invalidateQueries({ queryKey });
        refetch();
      }, 200);
    };

    const channel = supabase
      .channel(`booking_requests_${businessId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `business_id=eq.${businessId}`
        },
        (payload) => {
          console.log('[useBookingRequests] Booking requests table changed:', payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      console.log('[useBookingRequests] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient, queryKey, refetch]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      console.log(`[useBookingRequests] Updating booking request ${id} to status: ${status}`);
      
      // Only update the status of the booking request - DO NOT create event records
      // The calendar will show approved booking requests alongside regular events
      const { error } = await supabase
        .from('booking_requests')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) {
        console.error('[useBookingRequests] Error updating booking request status:', error);
        throw error;
      }

      console.log(`[useBookingRequests] Successfully updated booking request ${id} to ${status}`);

      // Clear calendar cache to ensure both calendars refresh
      clearCalendarCache();

      // Broadcast update event for cross-tab sync
      const updateEvent = new CustomEvent('booking-request-updated', {
        detail: { bookingId: id, status, timestamp: Date.now() }
      });
      window.dispatchEvent(updateEvent);

      return { id, status };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey });
      
      // Also invalidate calendar queries to show updated booking status
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });

      toast({
        title: "Success", 
        description: `Booking request ${data.status === 'approved' ? 'approved' : 'rejected'} successfully`,
      });
    },
    onError: (error: any) => {
      console.error('[useBookingRequests] Error updating booking request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update booking request",
        variant: "destructive",
      });
    },
  });

  const deleteBookingRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log(`[useBookingRequests] Deleting booking request ${id}`);
      
      const { error } = await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[useBookingRequests] Error deleting booking request:', error);
        throw error;
      }

      console.log(`[useBookingRequests] Successfully deleted booking request ${id}`);

      // Clear calendar cache
      clearCalendarCache();

      return { id };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      
      // Also invalidate calendar queries
      queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });

      toast({
        title: "Success", 
        description: "Booking request deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('[useBookingRequests] Error deleting booking request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking request",
        variant: "destructive",
      });
    },
  });

  const createBookingRequestMutation = useMutation({
    mutationFn: async (newBookingRequest: Omit<BookingRequest, 'id' | 'created_at' | 'updated_at'>) => {
      console.log("[useBookingRequests] Creating booking request:", newBookingRequest);

      if (!businessId) {
        throw new Error("Business ID is required to create a booking request.");
      }

      const { data, error } = await supabase
        .from('booking_requests')
        .insert([{ ...newBookingRequest, business_id: businessId }])
        .select()
        .single();

      if (error) {
        console.error("[useBookingRequests] Error creating booking request:", error);
        throw error;
      }

      console.log("[useBookingRequests] Successfully created booking request:", data);
      return data as BookingRequest;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Success",
        description: "Booking request created successfully",
      });
    },
    onError: (error: any) => {
      console.error("[useBookingRequests] Error creating booking request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create booking request",
        variant: "destructive",
      });
    },
  });

  return {
    bookingRequests,
    pendingRequests: filteredRequests.pending,
    approvedRequests: filteredRequests.approved,
    rejectedRequests: filteredRequests.rejected,
    isLoading,
    error,
    refetch,
    updateStatus: updateStatusMutation.mutateAsync,
    approveRequest: (id: string) => updateStatusMutation.mutateAsync({ id, status: 'approved' }),
    rejectRequest: (id: string) => updateStatusMutation.mutateAsync({ id, status: 'rejected' }),
    deleteBookingRequest: deleteBookingRequestMutation.mutateAsync,
    createBookingRequest: createBookingRequestMutation.mutateAsync,
  };
};
