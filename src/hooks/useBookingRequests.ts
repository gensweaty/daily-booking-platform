
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
        
        // IMPROVED: Convert dates to ISO strings to ensure consistent comparison
        const startDate = new Date(booking.start_date);
        const endDate = new Date(booking.end_date);
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();
        
        console.log("Checking for conflicts with time slot:", { 
          start: startISO, 
          end: endISO,
          startDate: startDate.toString(),
          endDate: endDate.toString()
        });
        
        // IMPROVED: Check for conflicts with events - use accurate comparison logic
        const { data: conflictingEvents, error: eventsError } = await supabase
          .from("events")
          .select("id, title, start_date, end_date")
          .is("deleted_at", null) // Only check non-deleted events
          .filter('start_date', 'lt', endISO) // Event starts before booking ends
          .filter('end_date', 'gt', startISO); // Event ends after booking starts
        
        if (eventsError) {
          console.error('Error checking for conflicting events:', eventsError);
          throw eventsError;
        }
        
        console.log('Conflicting events check result:', conflictingEvents);
        
        // IMPROVED: Check for conflicts with other approved bookings - exclude the current booking
        const { data: conflictingBookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('id, title, start_date, end_date')
          .eq('status', 'approved')
          .neq('id', bookingId) // Exclude the current booking
          .filter('start_date', 'lt', endISO) // Booking starts before this booking ends
          .filter('end_date', 'gt', startISO); // Booking ends after this booking starts
        
        if (bookingsError) {
          console.error('Error checking for conflicting bookings:', bookingsError);
          throw bookingsError;
        }
        
        console.log('Conflicting bookings check result:', conflictingBookings);
        
        if ((conflictingEvents && conflictingEvents.length > 0) || 
            (conflictingBookings && conflictingBookings.length > 0)) {
          console.error('Time slot conflicts found:', {
            events: conflictingEvents?.length || 0,
            bookings: conflictingBookings?.length || 0
          });
          
          // If there are conflicts, provide detailed information
          const conflictDetails = [];
          if (conflictingEvents && conflictingEvents.length > 0) {
            conflictDetails.push(`Conflicting events: ${conflictingEvents.map(e => e.title).join(', ')}`);
          }
          if (conflictingBookings && conflictingBookings.length > 0) {
            conflictDetails.push(`Conflicting bookings: ${conflictingBookings.map(b => b.title).join(', ')}`);
          }
          
          throw new Error(`Time slot is no longer available. ${conflictDetails.join(' ')}`);
        }
        
        // TRANSACTION: Wrap the entire approval process in a transaction
        // This ensures that if creating the event fails, the booking won't be marked as approved
        const { data: transaction, error: transactionError } = await supabase.rpc('begin_transaction');
        
        if (transactionError) {
          console.error('Error starting transaction:', transactionError);
          // If the database doesn't support transactions, we'll continue without it
          console.log('Continuing without transaction support');
        }
        
        try {
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
            
            // IMPROVED: Ensure all required fields have proper values and types
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
              // ROLLBACK if transaction is supported
              if (!transactionError) {
                await supabase.rpc('rollback_transaction');
              } else {
                // If we can't use a transaction, at least revert the booking status
                await supabase
                  .from('booking_requests')
                  .update({ status: 'pending' })
                  .eq('id', bookingId);
              }
              throw new Error('Failed to create event from booking: ' + eventError.message);
            }
            
            console.log('Created event:', createdEvent);
            
            // Create a customer record from the booking request for CRM
            if (createdEvent) {
              try {
                const { data: customerData, error: customerError } = await supabase
                  .from('customers')
                  .insert({
                    title: booking.requester_name || "",
                    user_surname: booking.requester_name || "",
                    user_number: booking.requester_phone || "",
                    social_network_link: booking.requester_email || "",
                    event_notes: booking.description || "",
                    start_date: startISO, // Use ISO string format
                    end_date: endISO, // Use ISO string format
                    payment_status: booking.payment_status || 'not_paid',
                    payment_amount: booking.payment_amount || null,
                    user_id: user.id,
                    type: 'booking_request',
                    created_at: new Date().toISOString(),
                    deleted_at: null // Explicitly set deleted_at to null
                  })
                  .select()
                  .single();
                
                if (customerError) {
                  console.error('Error creating customer from booking:', customerError);
                } else {
                  console.log('Created customer:', customerData);
                  
                  // Check if there are any files attached to the booking
                  const { data: bookingFiles, error: filesError } = await supabase
                    .from('booking_files')
                    .select('*')
                    .eq('booking_id', bookingId);
                    
                  if (filesError) {
                    console.error('Error checking for booking files:', filesError);
                  } else if (bookingFiles && bookingFiles.length > 0) {
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
                            user_id: user.id,
                            customer_id: customerData.id
                          });
                          
                        if (fileError) {
                          console.error('Error copying booking file to customer:', fileError);
                        }
                      }
                      
                      if (createdEvent?.id) {
                        // Create event file record
                        const { error: eventFileError } = await supabase
                          .from('event_files')
                          .insert({
                            filename: file.filename,
                            file_path: file.file_path,
                            content_type: file.content_type,
                            size: file.size,
                            user_id: user.id,
                            event_id: createdEvent.id
                          });
                          
                        if (eventFileError) {
                          console.error('Error copying booking file to event:', eventFileError);
                        }
                      }
                    }
                  }
                }
              } catch (customerError) {
                console.error('Error in customer creation:', customerError);
              }
            }
            
            // COMMIT if transaction is supported
            if (!transactionError) {
              await supabase.rpc('commit_transaction');
            }
            
            return { booking, event: createdEvent };
          } else {
            console.log('Event already exists for this booking, not creating a new one');
            return { booking, event: existingEvents[0] };
          }
        } catch (error) {
          // ROLLBACK on any error if transaction is supported
          if (!transactionError) {
            await supabase.rpc('rollback_transaction');
          }
          throw error;
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
