import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { BookingRequest } from "@/types/database";

export const useBookingRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const { toast } = useToast();
  
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
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      
      console.log(`Starting approval of booking ${bookingId}`);
      
      try {
        // Fetch the booking request details first
        const { data: booking, error: fetchError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('id', bookingId)
          .single();
        
        if (fetchError) {
          console.error('Error fetching booking:', fetchError);
          throw fetchError;
        }
        
        if (!booking) {
          console.error('Booking request not found:', bookingId);
          throw new Error('Booking request not found');
        }
        
        console.log('Fetched booking details:', booking);
        
        // Ensure dates are valid Date objects for consistent comparison
        const startDate = new Date(booking.start_date);
        const endDate = new Date(booking.end_date);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid booking dates');
        }
        
        // Format dates to ISO strings for consistent database comparison
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();
        
        console.log("Checking for conflicts with time slot:", { 
          startTime: startDate.toString(),
          endTime: endDate.toString(),
          startISO,
          endISO
        });
        
        // Check if the booking is already approved
        if (booking.status === 'approved') {
          console.log('Booking is already approved:', bookingId);
          
          // Check if event exists for this booking
          const { data: existingEvents } = await supabase
            .from('events')
            .select('*')
            .eq('booking_request_id', bookingId)
            .is('deleted_at', null);
            
          // If event already exists, just return the booking
          if (existingEvents && existingEvents.length > 0) {
            console.log('Event already exists for this booking:', existingEvents[0].id);
            return { booking, event: existingEvents[0] };
          }
          
          // Otherwise continue to create an event
        }
        
        // FIX: More accurate conflict detection with improved date comparison
        // Check for conflicts with events - use direct timestamp comparison
        const { data: conflictingEvents, error: eventsError } = await supabase
          .from("events")
          .select("id, title, start_date, end_date")
          .is("deleted_at", null) // Only check non-deleted events
          .or(`start_date.lt.${endISO},end_date.gt.${startISO}`); // Fix the overlap logic
        
        if (eventsError) {
          console.error('Error checking for conflicting events:', eventsError);
          throw eventsError;
        }
        
        // Filter events that actually overlap
        const actualConflictingEvents = conflictingEvents?.filter(event => {
          const eventStart = new Date(event.start_date);
          const eventEnd = new Date(event.end_date);
          
          return (
            (eventStart < endDate && eventEnd > startDate) // Check for actual overlap
          );
        });
        
        console.log(`Found ${actualConflictingEvents?.length || 0} truly conflicting events`);
        
        // Check for conflicts with other approved bookings - exclude the current booking
        const { data: conflictingBookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('id, title, start_date, end_date, requester_name')
          .eq('status', 'approved')
          .neq('id', bookingId) // Exclude the current booking
          .or(`start_date.lt.${endISO},end_date.gt.${startISO}`); // Fix the overlap logic
        
        if (bookingsError) {
          console.error('Error checking for conflicting bookings:', bookingsError);
          throw bookingsError;
        }
        
        // Filter bookings that actually overlap
        const actualConflictingBookings = conflictingBookings?.filter(b => {
          const bookingStart = new Date(b.start_date);
          const bookingEnd = new Date(b.end_date);
          
          return (
            (bookingStart < endDate && bookingEnd > startDate) // Check for actual overlap
          );
        });
        
        console.log(`Found ${actualConflictingBookings?.length || 0} truly conflicting bookings`);
        
        // If there are actual conflicts, throw error with details
        if ((actualConflictingEvents && actualConflictingEvents.length > 0) || 
            (actualConflictingBookings && actualConflictingBookings.length > 0)) {
          
          // If there are conflicts, provide detailed information
          const conflictDetails = [];
          if (actualConflictingEvents && actualConflictingEvents.length > 0) {
            conflictDetails.push(`Conflicting events: ${actualConflictingEvents.map(e => e.title).join(', ')}`);
          }
          if (actualConflictingBookings && actualConflictingBookings.length > 0) {
            conflictDetails.push(`Conflicting bookings: ${actualConflictingBookings.map(b => b.requester_name || b.title).join(', ')}`);
          }
          
          throw new Error(`Time slot is no longer available. ${conflictDetails.join(' ')}`);
        }
        
        // Update the booking request status to approved
        const { error: updateError } = await supabase
          .from('booking_requests')
          .update({ status: 'approved' })
          .eq('id', bookingId);
        
        if (updateError) {
          console.error('Error updating booking status:', updateError);
          throw updateError;
        }
        
        console.log('Booking status updated to approved');
        
        // First check if this booking already has an event created for it
        const { data: existingEvents, error: existingEventsError } = await supabase
          .from('events')
          .select('*')
          .eq('booking_request_id', bookingId);
          
        if (existingEventsError) {
          console.error('Error checking for existing events:', existingEventsError);
          throw existingEventsError;
        }
        
        // Create event only if one doesn't already exist
        if (!existingEvents || existingEvents.length === 0) {
          console.log('Creating event from booking request:', booking);
          
          // Ensure all required fields have proper values
          const eventToInsert = {
            title: booking.requester_name || booking.title || "Booking",
            start_date: startISO, // Use ISO string format
            end_date: endISO, // Use ISO string format
            user_surname: booking.requester_name || "",
            user_number: booking.requester_phone || "",
            social_network_link: booking.requester_email || "",
            event_notes: booking.description || "",
            type: 'booking_request',
            payment_status: booking.payment_status || 'not_paid',
            payment_amount: booking.payment_amount || null,
            user_id: user.id,
            booking_request_id: bookingId,
            created_at: new Date().toISOString(),
            deleted_at: null // Explicitly set deleted_at to null
          };
          
          console.log('Event data to insert:', eventToInsert);
          
          const { data: createdEvent, error: eventError } = await supabase
            .from('events')
            .insert([eventToInsert])
            .select()
            .single();
          
          if (eventError) {
            console.error('Error creating event from booking:', eventError);
            
            // Rollback by updating booking status back to pending
            await supabase
              .from('booking_requests')
              .update({ status: 'pending' })
              .eq('id', bookingId);
              
            throw new Error('Failed to create event from booking: ' + eventError.message);
          }
          
          console.log('Created event:', createdEvent);
          
          // Create a customer record from the booking request for CRM
          try {
            if (createdEvent) {
              await supabase
                .from('customers')
                .insert({
                  title: booking.requester_name || "",
                  user_surname: booking.requester_name || "",
                  user_number: booking.requester_phone || "",
                  social_network_link: booking.requester_email || "",
                  event_notes: booking.description || "",
                  start_date: startISO,
                  end_date: endISO,
                  payment_status: booking.payment_status || 'not_paid',
                  payment_amount: booking.payment_amount || null,
                  user_id: user.id,
                  type: 'booking_request',
                  deleted_at: null
                });
              
              console.log('Created customer record');
            }
          } catch (customerError) {
            console.error('Error creating customer record:', customerError);
            // Don't fail the whole operation if customer creation fails
          }
          
          return { booking, event: createdEvent };
        } else {
          console.log('Event already exists for this booking, not creating a new one');
          return { booking, event: existingEvents[0] };
        }
      } catch (error) {
        console.error("Error in approve booking process:", error);
        throw error;
      }
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
      console.error('Approve mutation error:', error);
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
