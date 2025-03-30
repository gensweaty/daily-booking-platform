
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
    if (!businessId || !user?.id) return [];
    
    const { data, error } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  };

  const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">): Promise<BookingRequest> => {
    if (!businessId || !user?.id) throw new Error("Business ID and User ID are required to create a booking request");
    
    const { data, error } = await supabase
      .from("booking_requests")
      .insert([{ 
        ...request, 
        business_id: businessId, 
        status: "pending",
        user_id: user.id 
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateBookingRequest = async ({ id, updates }: { id: string; updates: Partial<BookingRequest> }): Promise<BookingRequest> => {
    if (!businessId || !user?.id) throw new Error("Business ID and User ID are required to update a booking request");
    
    const { data, error } = await supabase
      .from("booking_requests")
      .update(updates)
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteBookingRequest = async (id: string): Promise<void> => {
    if (!businessId || !user?.id) throw new Error("Business ID and User ID are required to delete a booking request");
    
    const { error } = await supabase
      .from("booking_requests")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("user_id", user.id);

    if (error) throw error;
  };

  const { data: bookingRequests = [], isLoading, error } = useQuery({
    queryKey: ["bookingRequests", businessId, user?.id],
    queryFn: getBookingRequests,
    enabled: !!businessId && !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const pendingRequests = bookingRequests.filter(req => req.status === "pending");
  const approvedRequests = bookingRequests.filter(req => req.status === "approved");
  const rejectedRequests = bookingRequests.filter(req => req.status === "rejected");

  const createRequestMutation = useMutation({
    mutationFn: createBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", businessId, user?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", businessId, user?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", businessId, user?.id] });
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
