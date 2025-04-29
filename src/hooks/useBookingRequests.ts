
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookingRequest } from "@/types/database";
import { useState, useEffect } from "react";

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
      return data || [];
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

      // Also create an event for this approved booking
      try {
        // Get the full booking request data
        const { data: bookingData, error: fetchError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;

        console.log("Creating event from booking request with payment data:", {
          paymentStatus: bookingData.payment_status,
          paymentAmount: bookingData.payment_amount
        });

        // Create an event based on the booking details
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
            payment_status: bookingData.payment_status || 'not_paid',
            payment_amount: bookingData.payment_amount,
            user_id: user?.id,
            type: 'event',
            booking_request_id: id
          })
          .select('id')
          .single();

        if (eventError) throw eventError;

        // Also try to find any files associated with this booking request
        const { data: files, error: filesError } = await supabase
          .from('event_files')
          .select('*')
          .eq('event_id', id);

        if (filesError) {
          console.error("Error fetching booking request files:", filesError);
        } else if (files && files.length > 0) {
          console.log(`Found ${files.length} files for booking request ${id}`);
          
          // Copy files to reference the new event
          for (const file of files) {
            const { error: copyError } = await supabase
              .from('event_files')
              .insert({
                filename: file.filename,
                file_path: file.file_path,
                content_type: file.content_type,
                size: file.size,
                user_id: user?.id,
                event_id: eventData.id // Link to the new event
              });
              
            if (copyError) {
              console.error("Error copying file to new event:", copyError);
            } else {
              console.log("Successfully copied file to new event:", eventData.id);
            }
          }
        }

      } catch (eventCreationError) {
        console.error("Error creating event from booking:", eventCreationError);
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
