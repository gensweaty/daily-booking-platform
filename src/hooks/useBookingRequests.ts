
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { BookingRequest } from '@/types/database';
import { CalendarEventType } from '@/lib/types/calendar';
import { useLanguage } from '@/contexts/LanguageContext';

export const useBookingRequests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Get the business ID for the current user
  useEffect(() => {
    const getBusinessId = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching business profile:', error);
      } else if (data) {
        setBusinessId(data.id);
      }
    };
    
    getBusinessId();
  }, [user]);

  // Fetch booking requests
  const fetchBookingRequests = async () => {
    if (!businessId) return { pending: [], approved: [], rejected: [] };
    
    try {
      console.log("Fetching booking requests for business ID:", businessId);
      
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId);
        
      if (error) {
        console.error("Error fetching booking requests:", error);
        throw error;
      }
      
      if (!data) {
        console.log("No booking requests data returned");
        return { pending: [], approved: [], rejected: [] };
      }
      
      console.log(`Fetched ${data.length} total booking requests`);
      
      // Group requests by status and filter out soft-deleted ones
      const pending = data.filter(request => request.status === 'pending' && !request.deleted_at) || [];
      const approved = data.filter(request => request.status === 'approved' && !request.deleted_at) || [];
      const rejected = data.filter(request => request.status === 'rejected' && !request.deleted_at) || [];
      
      console.log("Booking requests by status:", { 
        pending: pending.length, 
        approved: approved.length, 
        rejected: rejected.length 
      });
      
      return { pending, approved, rejected };
    } catch (error) {
      console.error('Error fetching booking requests:', error);
      return { pending: [], approved: [], rejected: [] };
    }
  };

  // Query for booking requests
  const { data, isLoading, error } = useQuery({
    queryKey: ['bookingRequests', businessId],
    queryFn: fetchBookingRequests,
    enabled: !!businessId,
    refetchInterval: 5000 // Poll every 5 seconds to keep data fresh
  });

  const { pending: pendingRequests = [], approved: approvedRequests = [], rejected: rejectedRequests = [] } = data || {};

  // Handle approve booking
  const approveBooking = async (id: string) => {
    if (!user || !businessId) throw new Error("Authentication required");
    
    try {
      // Get the booking request details
      const { data: bookingRequest, error: fetchError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Update the booking request status
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', id);
        
      if (updateError) throw updateError;
      
      // Create a calendar event from the booking
      const eventData: Partial<CalendarEventType> = {
        title: bookingRequest.requester_name,
        user_surname: bookingRequest.requester_name,
        user_number: bookingRequest.requester_phone,
        social_network_link: bookingRequest.requester_email,
        event_notes: bookingRequest.description,
        start_date: bookingRequest.start_date,
        end_date: bookingRequest.end_date,
        type: 'event',
        payment_status: 'not_paid',
        booking_request_id: id, // Link to the original booking request
        user_id: user.id, // Assign to the business owner
      };
      
      // Create event in the events table
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert(eventData)
        .select()
        .single();
        
      if (eventError) throw eventError;
      
      // Copy any file attachments from the booking request to the event
      await copyBookingFilesToEvent(id, event.id);
      
      toast({
        title: t("business.bookingApproved"),
        description: t("business.bookingApprovedDescription")
      });
      
      return event;
    } catch (error) {
      console.error('Error approving booking:', error);
      toast({
        title: t("common.error"),
        description: t("business.errorApprovingBooking"),
        variant: "destructive"
      });
      throw error;
    }
  };

  // Helper to copy file attachments from booking request to event
  const copyBookingFilesToEvent = async (bookingId: string, eventId: string) => {
    try {
      // Get any files attached to the booking request
      const { data: files, error: filesError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', bookingId);
        
      if (filesError) {
        console.error("Error fetching booking request files:", filesError);
        return;
      }
      
      if (files && files.length > 0) {
        console.log(`Found ${files.length} files to copy from booking to event`);
        
        // Create new file records linking to the event
        for (const file of files) {
          const newFileData = {
            filename: file.filename,
            file_path: file.file_path,
            content_type: file.content_type,
            size: file.size,
            user_id: user?.id,
            event_id: eventId
          };
          
          const { error } = await supabase
            .from('event_files')
            .insert(newFileData);
            
          if (error) {
            console.error("Error copying file to event:", error);
          } else {
            console.log("Successfully copied file from booking to event:", file.filename);
          }
        }
      }
    } catch (error) {
      console.error("Error copying files from booking to event:", error);
    }
  };

  // Handle reject booking
  const rejectBooking = async (id: string) => {
    if (!businessId) throw new Error("Business ID required");
    
    try {
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', id);
        
      if (error) throw error;
      
      toast({
        title: t("business.bookingRejected"),
        description: t("business.bookingRejectedDescription")
      });
    } catch (error) {
      console.error('Error rejecting booking:', error);
      toast({
        title: t("common.error"),
        description: t("business.errorRejectingBooking"),
        variant: "destructive"
      });
      throw error;
    }
  };

  // Handle delete booking
  const deleteBooking = async (id: string) => {
    if (!businessId) throw new Error("Business ID required");
    
    try {
      // Soft delete by setting deleted_at field
      const { error } = await supabase
        .from('booking_requests')
        .update({ 
          deleted_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      
      // If there are related events that were created from this booking, also soft delete them
      const { data: relatedEvents, error: relatedError } = await supabase
        .from('events')
        .select('id')
        .eq('booking_request_id', id);
        
      if (relatedError) {
        console.error("Error finding related events:", relatedError);
      } else if (relatedEvents && relatedEvents.length > 0) {
        console.log(`Found ${relatedEvents.length} events to soft delete`);
        
        for (const event of relatedEvents) {
          const { error: updateError } = await supabase
            .from('events')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', event.id);
            
          if (updateError) {
            console.error(`Error soft-deleting event ${event.id}:`, updateError);
          } else {
            console.log(`Soft-deleted event: ${event.id}`);
          }
        }
      }
      
      toast({
        title: t("business.bookingDeleted"),
        description: t("business.bookingDeletedDescription")
      });
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: t("common.error"),
        description: t("business.errorDeletingBooking"),
        variant: "destructive"
      });
      throw error;
    }
  };

  // Mutations
  const approveMutation = useMutation({
    mutationFn: approveBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
    },
  });

  return {
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    isLoading,
    error,
    approveBooking: approveMutation.mutate,
    rejectBooking: rejectMutation.mutate,
    deleteBooking: deleteMutation.mutate,
    businessId
  };
};
