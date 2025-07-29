import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BookingRequest } from '@/types/database';
import { CalendarEventType } from '@/lib/types/calendar';

// Helper function to check if two time ranges overlap
const timeRangesOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
  return start1 < end2 && end1 > start2;
};

export const useBookingRequests = (businessId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchBookingRequests = async (): Promise<BookingRequest[]> => {
    if (!user?.id) return [];

    let query = supabase
      .from('booking_requests')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    } else {
      const { data: businessProfiles } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id);

      if (businessProfiles && businessProfiles.length > 0) {
        const businessIds = businessProfiles.map(bp => bp.id);
        query = query.in('business_id', businessIds);
      } else {
        return [];
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Cast the data to ensure status is properly typed
    return (data || []).map(item => ({
      ...item,
      status: item.status as 'pending' | 'approved' | 'rejected'
    })) as BookingRequest[];
  };

  const {
    data: bookingRequests = [],
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: businessId ? ['booking-requests', businessId] : ['booking-requests', user?.id],
    queryFn: fetchBookingRequests,
    enabled: !!user?.id,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const pendingRequests = bookingRequests.filter(req => req.status === 'pending');
  const approvedRequests = bookingRequests.filter(req => req.status === 'approved');
  const rejectedRequests = bookingRequests.filter(req => req.status === 'rejected');

  const approveBookingRequest = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useBookingRequests] Approving booking request:", bookingId);

      // Find the booking request to approve
      const bookingToApprove = bookingRequests.find(req => req.id === bookingId);
      if (!bookingToApprove) {
        throw new Error("Booking request not found");
      }

      const bookingStart = new Date(bookingToApprove.start_date);
      const bookingEnd = new Date(bookingToApprove.end_date);

      console.log("[useBookingRequests] Checking conflicts for booking:", {
        id: bookingId,
        start: bookingStart,
        end: bookingEnd
      });

      // Get existing events from React Query cache - try multiple possible query keys
      let existingEvents: CalendarEventType[] = [];
      
      // Try to get events from different possible cache keys
      const eventsFromUserCache = queryClient.getQueryData<CalendarEventType[]>(['events', user.id]);
      const eventsFromBusinessCache = businessId ? queryClient.getQueryData<CalendarEventType[]>(['business-events', businessId]) : null;
      const optimizedEventsCache = queryClient.getQueryData<{events: CalendarEventType[], bookingRequests: any[]}>(['optimized-calendar-events', user.id, new Date().toISOString().slice(0, 7)]);
      
      if (eventsFromUserCache) {
        existingEvents = eventsFromUserCache;
      } else if (eventsFromBusinessCache) {
        existingEvents = eventsFromBusinessCache;
      } else if (optimizedEventsCache?.events) {
        existingEvents = optimizedEventsCache.events;
      }

      console.log("[useBookingRequests] Found existing events for conflict check:", existingEvents.length);
      
      // Check for conflicts with existing events
      const conflictingEvent = existingEvents.find(event => {
        const eventStart = new Date(event.start_date);
        const eventEnd = new Date(event.end_date);
        
        const hasOverlap = timeRangesOverlap(bookingStart, bookingEnd, eventStart, eventEnd);
        
        if (hasOverlap) {
          console.log("[useBookingRequests] Found conflicting event:", {
            eventId: event.id,
            eventTitle: event.title,
            eventStart: eventStart,
            eventEnd: eventEnd,
            bookingStart: bookingStart,
            bookingEnd: bookingEnd
          });
        }
        
        return hasOverlap;
      });

      if (conflictingEvent) {
        console.log("[useBookingRequests] Conflict detected with existing event, blocking approval");
        toast({
          variant: "destructive",
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "events.timeConflictError"
          }
        });
        throw new Error("time-conflict");
      }

      // Check for conflicts with other approved booking requests
      const conflictingBooking = approvedRequests.find(req => 
        req.id !== bookingId && timeRangesOverlap(
          bookingStart, 
          bookingEnd, 
          new Date(req.start_date), 
          new Date(req.end_date)
        )
      );

      if (conflictingBooking) {
        console.log("[useBookingRequests] Conflict detected with approved booking, blocking approval");
        toast({
          variant: "destructive",
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "events.timeConflictError"
          }
        });
        throw new Error("time-conflict");
      }

      console.log("[useBookingRequests] No conflicts found, proceeding with approval");

      // If no conflicts, proceed with approval
      const { data, error } = await supabase
        .from('booking_requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "bookings.requestApproved"
        }
      });
    },
    onError: (error: any) => {
      console.error("[useBookingRequests] Error approving booking:", error);
      
      // Don't show generic error for time conflicts (we already showed specific toast)
      if (error.message !== "time-conflict") {
        toast({
          variant: "destructive",
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "bookings.errorApproving"
          }
        });
      }
    },
  });

  const rejectBookingRequest = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useBookingRequests] Rejecting booking request:", bookingId);

      const { data, error } = await supabase
        .from('booking_requests')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "bookings.requestRejected"
        }
      });
    },
    onError: (error: any) => {
      console.error("[useBookingRequests] Error rejecting booking:", error);
      toast({
        variant: "destructive",
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "bookings.errorRejecting"
        }
      });
    },
  });

  const deleteBookingRequest = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useBookingRequests] Deleting booking request:", bookingId);

      const { error } = await supabase
        .from('booking_requests')
        .update({ 
          deleted_at: new Date().toISOString() 
        })
        .eq('id', bookingId);

      if (error) throw error;

      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "bookings.requestDeleted"
        }
      });
    },
    onError: (error: any) => {
      console.error("[useBookingRequests] Error deleting booking:", error);
      toast({
        variant: "destructive",
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "bookings.errorDeleting"
        }
      });
    },
  });

  return {
    data: bookingRequests,
    bookingRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    isLoading,
    isError,
    error,
    refetch,
    approveBookingRequest: approveBookingRequest.mutateAsync,
    approveRequest: approveBookingRequest.mutateAsync,
    rejectBookingRequest: rejectBookingRequest.mutateAsync,
    rejectRequest: rejectBookingRequest.mutateAsync,
    deleteBookingRequest: deleteBookingRequest.mutateAsync,
    isApprovingBooking: approveBookingRequest.isPending,
    isRejectingBooking: rejectBookingRequest.isPending,
    isDeletingBooking: deleteBookingRequest.isPending,
  };
};
