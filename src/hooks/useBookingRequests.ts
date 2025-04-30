
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { associateBookingFilesWithEvent } from "@/integrations/supabase/client";
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
    return data as BookingRequest[];
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

  // Helper function to associate booking files with an event
  const associateBookingFilesWithEvent = async (bookingId: string, eventId: string): Promise<void> => {
    try {
      console.log(`Associating files from booking ${bookingId} with event ${eventId}`);
      
      // First, find all files associated with the booking request
      const { data: bookingFiles, error: fetchError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', bookingId);
        
      if (fetchError) {
        console.error('Error fetching booking files:', fetchError);
        return;
      }
      
      if (!bookingFiles || bookingFiles.length === 0) {
        console.log('No files found for booking request:', bookingId);
        return;
      }
      
      console.log(`Found ${bookingFiles.length} files to associate with event ${eventId}`);
      
      // Create new file entries that point to the same storage objects but are associated with the event
      for (const file of bookingFiles) {
        const { error: insertError } = await supabase
          .from('event_files')
          .insert({
            filename: file.filename,
            file_path: file.file_path,
            content_type: file.content_type,
            size: file.size,
            user_id: file.user_id,
            event_id: eventId
          });
          
        if (insertError) {
          console.error('Error creating file association:', insertError);
        }
      }
      
      console.log('Successfully associated booking files with event');
    } catch (error) {
      console.error('Exception in associateBookingFilesWithEvent:', error);
    }
  };

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
      
      // Ensure all required fields are explicitly set
      const eventData = {
        title: request.title || request.requester_name || "Booking",
        start_date: request.start_date,
        end_date: request.end_date,
        user_surname: request.requester_name,
        user_number: request.requester_phone,
        social_network_link: request.requester_email,
        event_notes: request.description,
        type: "booking_request", // Explicitly set as booking_request to ensure proper coloring
        payment_status: request.payment_status || "not_paid",
        payment_amount: request.payment_amount,
        user_id: user.id,
        original_booking_id: id
      };
      
      console.log("Creating event with data:", eventData);
      
      const { data: newEvent, error: eventError } = await supabase
        .from("events")
        .insert([eventData])
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
      return rejectMutation.mutateAsync(id);
    },
    [rejectMutation]
  );

  const deleteBookingRequest = useCallback(
    (id: string) => {
      return deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
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
