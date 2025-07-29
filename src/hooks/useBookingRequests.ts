import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, associateBookingFilesWithEvent } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BookingRequest } from '@/types/database';
import { CalendarEventType } from '@/lib/types/calendar';
import { sendBookingConfirmationEmail } from '@/lib/api';

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

      // Step 1: Update booking request status to approved
      const { data: updatedBooking, error: updateError } = await supabase
        .from('booking_requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        console.error("[useBookingRequests] Error updating booking status:", updateError);
        throw updateError;
      }

      console.log("[useBookingRequests] Booking status updated to approved");

      // Step 2: Create customer record from the approved booking - CRITICAL FIX
      const customerData = {
        id: bookingToApprove.id, // use booking request ID to link event and customer
        user_id: bookingToApprove.user_id || user.id,
        title: bookingToApprove.requester_name || bookingToApprove.user_surname || 'Customer',
        user_surname: bookingToApprove.user_surname || bookingToApprove.requester_name || null,
        user_number: bookingToApprove.requester_phone,
        social_network_link: bookingToApprove.requester_email,
        payment_status: bookingToApprove.payment_status || 'not_paid',
        payment_amount: bookingToApprove.payment_amount,
        start_date: bookingToApprove.start_date,
        end_date: bookingToApprove.end_date,
        event_notes: bookingToApprove.description,
        type: 'booking_request',
        create_event: true,
        event_id: bookingToApprove.id // CRITICAL: Set event_id to booking ID for CRM file linking
      };

      console.log("[useBookingRequests] Creating customer with data:", customerData);

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (customerError) {
        console.error("[useBookingRequests] Error creating customer:", customerError);
        // Don't throw here, continue with event creation
      } else {
        console.log("[useBookingRequests] Customer created successfully:", newCustomer.id);
      }

      // Step 3: Create calendar event from the approved booking
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert([{
          id: bookingId,
          user_id: bookingToApprove.user_id || user.id,
          title: bookingToApprove.title,
          user_surname: bookingToApprove.user_surname || bookingToApprove.requester_name,
          user_number: bookingToApprove.requester_phone,
          social_network_link: bookingToApprove.requester_email,
          start_date: bookingToApprove.start_date,
          end_date: bookingToApprove.end_date,
          payment_status: bookingToApprove.payment_status || 'not_paid',
          payment_amount: bookingToApprove.payment_amount,
          type: 'booking_request',
          booking_request_id: bookingId,
          event_notes: bookingToApprove.description,
          language: bookingToApprove.language || 'en'
        }])
        .select()
        .single();

      if (eventError) {
        console.error("[useBookingRequests] Error creating event:", eventError);
        throw eventError;
      }

      console.log("[useBookingRequests] Calendar event created:", newEvent.id);

      // Step 4: Associate booking files with the new event
      try {
        console.log("[useBookingRequests] Associating booking files with event");
        const associatedFiles = await associateBookingFilesWithEvent(
          bookingId,
          bookingId,
          user.id
        );
        console.log("[useBookingRequests] Associated files:", associatedFiles.length);
      } catch (fileError) {
        console.error("[useBookingRequests] Error associating files:", fileError);
      }

      // Step 5: Send confirmation email with proper full name
      try {
        console.log("[useBookingRequests] Sending approval email for booking:", bookingId);
        
        const { data: businessProfile, error: businessError } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('id', bookingToApprove.business_id)
          .single();

        if (businessError) {
          console.error("[useBookingRequests] Error fetching business profile:", businessError);
        } else if (businessProfile && bookingToApprove.requester_email) {
          const fullName =
            bookingToApprove.requester_name ||
            bookingToApprove.user_surname ||
            bookingToApprove.title ||
            'Customer';
          
          console.log("[useBookingRequests] Using full name for email:", fullName);
          
          await sendBookingConfirmationEmail(
            bookingToApprove.requester_email,
            fullName,
            businessProfile.business_name,
            bookingToApprove.start_date,
            bookingToApprove.end_date,
            bookingToApprove.payment_status || 'not_paid',
            bookingToApprove.payment_amount,
            businessProfile.contact_address || '',
            bookingId,
            bookingToApprove.language || 'en',
            bookingToApprove.description || ''
          );
          
          console.log("[useBookingRequests] Approval email sent successfully");
        }
      } catch (emailError) {
        console.error("[useBookingRequests] Error sending approval email:", emailError);
      }

      return updatedBooking;
    },
    onSuccess: () => {
      console.log("[useBookingRequests] Invalidating queries after successful approval");
      
      // Booking requests
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
      
      // Calendar events
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-calendar-events'] });
      
      // CRM data
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-customers'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-crm-data'] });
      
      // Statistics
      queryClient.invalidateQueries({ queryKey: ['optimized-event-stats'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-customer-stats'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-task-stats'] });
      
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "bookings.requestApproved"
        }
      });
    },
    onError: (error: any) => {
      console.error("[useBookingRequests] Error approving booking:", error);
      
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
