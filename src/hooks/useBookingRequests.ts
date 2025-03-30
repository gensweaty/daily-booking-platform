
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";
import { useToast } from "@/components/ui/use-toast";

export const useBookingRequests = (businessId: string | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getBookingRequests = async (): Promise<BookingRequest[]> => {
    if (!businessId) return [];
    
    const { data, error } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  };

  const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status">): Promise<BookingRequest> => {
    if (!businessId) throw new Error("Business ID is required to create a booking request");
    
    const { data, error } = await supabase
      .from("booking_requests")
      .insert([{ ...request, business_id: businessId, status: "pending" }])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateBookingRequest = async ({ id, updates }: { id: string; updates: Partial<BookingRequest> }): Promise<BookingRequest> => {
    if (!businessId) throw new Error("Business ID is required to update a booking request");
    
    const { data, error } = await supabase
      .from("booking_requests")
      .update(updates)
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteBookingRequest = async (id: string): Promise<void> => {
    if (!businessId) throw new Error("Business ID is required to delete a booking request");
    
    const { error } = await supabase
      .from("booking_requests")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) throw error;
  };

  // Add booking to calendar events when approved
  const addBookingToEvents = async (booking: BookingRequest): Promise<void> => {
    // Check if this booking is already in events
    const { data: existingEvents } = await supabase
      .from("events")
      .select("id")
      .eq("booking_request_id", booking.id)
      .maybeSingle();

    if (existingEvents) {
      console.log("Booking already exists in events, skipping creation");
      return;
    }

    const { error } = await supabase
      .from("events")
      .insert([{
        title: `${booking.requester_name} - ${booking.title}`,
        event_notes: booking.description || "",
        start_date: booking.start_date,
        end_date: booking.end_date,
        user_surname: "",
        user_number: booking.requester_phone || "",
        social_network_link: booking.requester_email || "",
        business_id: businessId,
        booking_request_id: booking.id,
      }]);

    if (error) {
      console.error("Error adding booking to events:", error);
      throw error;
    }
    
    // Also invalidate events cache to refresh calendars
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const { data: bookingRequests = [], isLoading, error } = useQuery({
    queryKey: ["bookingRequests", businessId],
    queryFn: getBookingRequests,
    enabled: !!businessId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const pendingRequests = bookingRequests.filter(req => req.status === "pending");
  const approvedRequests = bookingRequests.filter(req => req.status === "approved");
  const rejectedRequests = bookingRequests.filter(req => req.status === "rejected");

  const createRequestMutation = useMutation({
    mutationFn: createBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", businessId] });
      toast({
        title: "Success",
        description: "Booking request submitted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit booking request",
        variant: "destructive",
      });
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: updateBookingRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", businessId] });
      
      // If the booking was approved, add it to events
      if (data.status === "approved") {
        addBookingToEvents(data).catch(error => {
          console.error("Failed to add approved booking to calendar:", error);
          toast({
            title: "Warning",
            description: "Booking approved, but failed to add to calendar. Please check your events.",
            variant: "destructive",
          });
        });
      }
      
      toast({
        title: "Success",
        description: "Booking request updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking request",
        variant: "destructive",
      });
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: deleteBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", businessId] });
      toast({
        title: "Success",
        description: "Booking request deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking request",
        variant: "destructive",
      });
    },
  });

  const approveRequest = async (id: string) => {
    await updateRequestMutation.mutateAsync({ id, updates: { status: "approved" } });
  };

  const rejectRequest = async (id: string) => {
    await updateRequestMutation.mutateAsync({ id, updates: { status: "rejected" } });
  };

  return {
    bookingRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    isLoading,
    error,
    createBookingRequest: createRequestMutation.mutate,
    updateBookingRequest: updateRequestMutation.mutate,
    deleteBookingRequest: deleteRequestMutation.mutate,
    approveRequest,
    rejectRequest,
  };
};
