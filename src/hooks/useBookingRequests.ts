
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookingRequest } from "@/types/database";
import { useState, useEffect } from "react";
import { FileRecord } from "@/types/files";

export const useBookingRequests = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Fetch the business ID for the current user
  useEffect(() => {
    const fetchBusinessId = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching business profile:", error);
        return;
      }

      if (data) {
        setBusinessId(data.id);
      }
    };

    fetchBusinessId();
  }, [user]);

  // Fetch all booking requests
  const { data: bookingRequests = [], isLoading, error } = useQuery({
    queryKey: ['bookingRequests', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      // Filter by status instead of using deleted_at column
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching booking requests:", error);
        throw error;
      }

      console.log("Fetched booking requests:", data);
      
      // Normalize payment status in fetched data
      const normalizedRequests = (data || []).map(request => {
        // Make a copy of the original request
        const normalizedRequest = { ...request };
        
        // Normalize payment status
        if (normalizedRequest.payment_status) {
          if (normalizedRequest.payment_status === 'partly') {
            normalizedRequest.payment_status = 'partly_paid';
          } else if (normalizedRequest.payment_status === 'fully') {
            normalizedRequest.payment_status = 'fully_paid';
          }
        }
        
        return normalizedRequest;
      });
      
      // Fetch files for each booking request
      for (const request of normalizedRequests) {
        try {
          console.log(`Fetching files for booking request: ${request.id}`);
          
          const { data: files, error: filesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', request.id);
            
          if (filesError) {
            console.error(`Error fetching files for booking request ${request.id}:`, filesError);
          } else if (files && files.length > 0) {
            console.log(`Found ${files.length} files for booking request ${request.id}:`, files);
            request.files = files.map(file => ({
              ...file,
              parentType: 'event' as const
            }));
            request.file_count = files.length;
          } else {
            console.log(`No files found for booking request ${request.id}`);
            request.files = [];
            request.file_count = 0;
          }
        } catch (err) {
          console.error(`Exception fetching files for booking request ${request.id}:`, err);
        }
      }
      
      return normalizedRequests;
    },
    enabled: !!businessId,
    staleTime: 1000 * 60,
    refetchInterval: 30000, // Refresh data every 30 seconds
  });

  // Filter booking requests by status
  const pendingRequests = bookingRequests.filter((request) => request.status === 'pending');
  const approvedRequests = bookingRequests.filter((request) => request.status === 'approved');
  const rejectedRequests = bookingRequests.filter((request) => request.status === 'rejected');

  // Approve a booking request
  const approveBookingMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("Starting booking approval process for ID:", id);
      
      // Get the full booking request data with all fields first
      const { data: bookingData, error: fetchError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error("Error fetching complete booking data:", fetchError);
        throw fetchError;
      }

      console.log("Full booking data retrieved for approval:", bookingData);
      
      // Normalize payment status for consistency
      let normalizedPaymentStatus = bookingData.payment_status || 'not_paid';
      if (normalizedPaymentStatus === 'partly') normalizedPaymentStatus = 'partly_paid';
      else if (normalizedPaymentStatus === 'fully') normalizedPaymentStatus = 'fully_paid';
      
      console.log("Normalized payment status for transfer:", normalizedPaymentStatus);
      console.log("Payment amount for transfer:", bookingData.payment_amount);
      
      // Update booking request status
      const { data, error } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error("Error approving booking request:", error);
        throw error;
      }

      console.log("Successfully updated booking request status to approved:", data);

      // Fetch files associated with this booking request
      const { data: files, error: filesError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', id);

      if (filesError) {
        console.error("Error fetching booking request files:", filesError);
      } else {
        console.log(`Found ${files?.length || 0} files for booking request ${id}:`, files);
      }

      // Create an event based on the booking details with the payment information
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          title: bookingData.title,
          user_surname: bookingData.requester_name,
          user_number: bookingData.requester_phone,
          social_network_link: bookingData.requester_email,
          event_notes: bookingData.description,
          start_date: bookingData.start_date,
          end_date: bookingData.end_date,
          payment_status: normalizedPaymentStatus, // Use the normalized payment status
          payment_amount: bookingData.payment_amount, // Use the original payment amount
          user_id: user?.id,
          type: 'event',
          booking_request_id: id // Store reference to the original booking request
        })
        .select()
        .single();

      if (eventError) {
        console.error("Error creating event from booking:", eventError);
        throw eventError;
      }

      console.log("Successfully created event from booking with payment data:", eventData);

      // Copy files associated with this booking request to reference the new event
      if (files && files.length > 0) {
        console.log(`Found ${files.length} files to copy for booking request ${id}`);
        
        for (const file of files) {
          const fileData = {
            filename: file.filename,
            file_path: file.file_path,
            content_type: file.content_type,
            size: file.size,
            user_id: user?.id,
            event_id: eventData.id // Link to the new event
          };
          
          console.log("Creating file copy with data:", fileData);
          
          const { data: newFile, error: copyError } = await supabase
            .from('event_files')
            .insert(fileData)
            .select();
            
          if (copyError) {
            console.error("Error copying file to new event:", copyError);
          } else {
            console.log("Successfully copied file to new event:", newFile);
          }
        }
      } else {
        console.log("No files found for booking request ID:", id);
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: t("business.bookingApproved"),
        description: t("business.bookingApprovedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
    },
    onError: (error) => {
      toast({
        title: t("common.error"),
        description: error.message || t("business.errorApprovingBooking"),
        variant: "destructive",
      });
    }
  });

  // Reject a booking request
  const rejectBookingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error("Error rejecting booking request:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: t("business.bookingRejected"),
        description: t("business.bookingRejectedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
    },
    onError: (error) => {
      toast({
        title: t("common.error"),
        description: error.message || t("business.errorRejectingBooking"),
        variant: "destructive",
      });
    }
  });

  // Delete a booking request (using status="deleted" instead of deleted_at)
  const deleteBookingMutation = useMutation({
    mutationFn: async (id: string) => {
      // Instead of setting a deleted_at timestamp, we'll update the status to 'deleted'
      const { data, error } = await supabase
        .from('booking_requests')
        .update({ status: 'deleted' })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error("Error deleting booking request:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: t("business.bookingDeleted"),
        description: t("business.bookingDeletedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
    },
    onError: (error) => {
      toast({
        title: t("common.error"),
        description: error.message || t("business.errorDeletingBooking"),
        variant: "destructive",
      });
    }
  });

  return {
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    isLoading,
    error,
    approveBooking: approveBookingMutation.mutate,
    rejectBooking: rejectBookingMutation.mutate,
    deleteBooking: deleteBookingMutation.mutate,
    businessId: businessId || '',
  };
};
