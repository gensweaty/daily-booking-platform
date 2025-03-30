
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export const useBookingRequests = (businessId: string | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const getBookingRequests = async (): Promise<BookingRequest[]> => {
    if (!user?.id) return [];
    
    const { data, error } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  };

  const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">): Promise<BookingRequest> => {
    // Allow creating booking requests without authentication
    const { data, error } = await supabase
      .from("booking_requests")
      .insert([{ 
        ...request, 
        status: "pending",
        // Set user_id to authenticated user if available, otherwise null
        user_id: user?.id || null
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateBookingRequest = async ({ id, updates }: { id: string; updates: Partial<BookingRequest> }): Promise<BookingRequest> => {
    if (!user?.id) throw new Error("User ID is required to update a booking request");
    
    const { data, error } = await supabase
      .from("booking_requests")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteBookingRequest = async (id: string): Promise<void> => {
    if (!user?.id) throw new Error("User ID is required to delete a booking request");
    
    const { error } = await supabase
      .from("booking_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
  };

  const { data: bookingRequests = [], isLoading, error } = useQuery({
    queryKey: ["bookingRequests", user?.id],
    queryFn: getBookingRequests,
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const pendingRequests = bookingRequests.filter(req => req.status === "pending");
  const approvedRequests = bookingRequests.filter(req => req.status === "approved");
  const rejectedRequests = bookingRequests.filter(req => req.status === "rejected");

  const createRequestMutation = useMutation({
    mutationFn: createBookingRequest,
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["bookingRequests", user?.id] });
      }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", user?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", user?.id] });
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

  const approveRequest = (id: string) => {
    updateRequestMutation.mutate({ id, updates: { status: "approved" } });
  };

  const rejectRequest = (id: string) => {
    updateRequestMutation.mutate({ id, updates: { status: "rejected" } });
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
