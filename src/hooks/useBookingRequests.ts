import { useState, useCallback } from "react";
import { supabase, associateBookingFilesWithEvent } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookingRequest } from "@/types/database";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";

export const useBookingRequests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Fetch business profile ID for the current user
  const { data: businessProfile } = useQuery({
    queryKey: ["businessProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch booking requests for the business
  const fetchBookingRequests = async () => {
    if (!businessProfile?.id) return [];

    const { data, error } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("business_id", businessProfile.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const { data: bookingRequests = [], isLoading } = useQuery({
    queryKey: ["bookingRequests", businessProfile?.id],
    queryFn: fetchBookingRequests,
    enabled: !!businessProfile?.id,
  });

  // Group booking requests by status
  const pendingRequests = bookingRequests.filter(
    (request) => request.status === "pending"
  );
  const approvedRequests = bookingRequests.filter(
    (request) => request.status === "approved"
  );
  const rejectedRequests = bookingRequests.filter(
    (request) => request.status === "rejected"
  );

  // Approve booking request mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("User must be authenticated to approve bookings");
      
      console.log("Approving booking request:", id);
      
      // Get the booking request details
      const { data: request, error: fetchError } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("id", id)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Update booking request status
      const { error: updateError } = await supabase
        .from("booking_requests")
        .update({ status: "approved" })
        .eq("id", id);
        
      if (updateError) throw updateError;
      
      // Create event in calendar based on booking request
      console.log("Creating calendar event from booking request:", request);
      
      // Map booking request to calendar event
      const eventData: Partial<CalendarEventType> = {
        title: request.requester_name,
        user_surname: request.requester_name,
        user_number: request.requester_phone,
        social_network_link: request.requester_email,
        event_notes: request.description,
        start_date: request.start_date,
        end_date: request.end_date,
        type: "event",
        payment_status: "not_paid",
        original_booking_id: id  // Store original booking id for file association
      };
      
      const { data: newEvent, error: eventError } = await supabase
        .from("events")
        .insert([{ ...eventData, user_id: user.id }])
        .select()
        .single();
        
      if (eventError) throw eventError;
      
      console.log("Created new event from booking request:", newEvent);
      
      // Associate existing files with the new event
      await associateBookingFilesWithEvent(id, newEvent.id);
      
      return { request, newEvent };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: t("bookings.approveSuccess"),
        description: t("bookings.requestApproved"),
      });
    },
    onError: (error: any) => {
      console.error("Error approving booking request:", error);
      toast({
        title: t("common.error"),
        description: t("bookings.approveError"),
        variant: "destructive",
      });
    },
  });

  // Reject booking request mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("booking_requests")
        .update({ status: "rejected" })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
      toast({
        title: t("bookings.rejectSuccess"),
        description: t("bookings.requestRejected"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to reject booking request",
        variant: "destructive"
      });
    }
  });

  // Delete booking request mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("booking_requests")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
      toast({
        title: t("bookings.deleteSuccess"),
        description: t("bookings.requestDeleted"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete booking request",
        variant: "destructive"
      });
    }
  });

  // Wrapper functions
  const approveRequest = useCallback(
    (id: string) => {
      return approveMutation.mutateAsync(id);
    },
    [approveMutation]
  );

  const rejectRequest = useCallback(
    (id: string) => {
      setLoading(true);
      supabase
        .from("booking_requests")
        .update({ status: "rejected" })
        .eq("id", id)
        .then(() => {
          toast({
            title: t("bookings.rejectSuccess"),
            description: t("bookings.requestRejected"),
          });
          queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
        })
        .catch((error) => {
          console.error("Error rejecting booking request:", error);
          toast({
            title: t("common.error"),
            description: t("bookings.rejectError"),
            variant: "destructive",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [toast, queryClient, t]
  );

  const deleteBookingRequest = useCallback(
    (id: string) => {
      setLoading(true);
      supabase
        .from("booking_requests")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .then(() => {
          toast({
            title: t("bookings.deleteSuccess"),
            description: t("bookings.requestDeleted"),
          });
          queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
        })
        .catch((error) => {
          console.error("Error deleting booking request:", error);
          toast({
            title: t("common.error"),
            description: t("bookings.deleteError"),
            variant: "destructive",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [toast, queryClient, t]
  );

  return {
    bookingRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    loading: loading || isLoading,
    approveRequest,
    rejectRequest,
    deleteBookingRequest,
  };
};
