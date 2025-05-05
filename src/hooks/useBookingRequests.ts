
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BookingRequest, BusinessProfile } from "@/types/database";
import { useToast } from "@/components/ui/use-toast";
import { useBusinessProfile } from "./useBusinessProfile";

interface BookingRequestParams {
  businessId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export const useBookingRequests = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { businessProfile } = useBusinessProfile();

  const getBookingRequests = async (params: BookingRequestParams): Promise<BookingRequest[]> => {
    let query = supabase
      .from("booking_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (params.businessId) {
      query = query.eq("business_id", params.businessId);
    }

    // Only fetch booking requests for the logged-in user if userId is provided
    if (params.userId) {
      query = query.eq("user_id", params.userId);
    }

    if (params.startDate && params.endDate) {
      query = query.gte("start_date", params.startDate).lte("end_date", params.endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching booking requests:", error);
      throw error;
    }

    return data || [];
  };

  const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at">): Promise<BookingRequest> => {
    const { data, error } = await supabase
      .from("booking_requests")
      .insert([request])
      .select()
      .single();

    if (error) {
      console.error("Error creating booking request:", error);
      throw error;
    }

    return data;
  };

  const updateBookingRequest = async (id: string, updates: Partial<BookingRequest>): Promise<BookingRequest> => {
    const { data, error } = await supabase
      .from("booking_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating booking request:", error);
      throw error;
    }

    return data;
  };

  const deleteBookingRequest = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("booking_requests")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting booking request:", error);
      throw error;
    }
  };

  const approveBooking = async (booking: BookingRequest): Promise<void> => {
    if (!businessProfile) {
      throw new Error("Business profile not loaded");
    }

    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      // Optimistically update the booking request status
      queryClient.setQueryData<BookingRequest[]>(
        ["bookingRequests", { businessId: booking.business_id }],
        (old) =>
          old?.map((req) => (req.id === booking.id ? { ...req, status: "approved" } : req))
      );

      // Call the updateBookingRequest function to update the booking status in the database
      await updateBookingRequest(booking.id, { status: "approved" });

      // Send confirmation email
      if (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL && apiKey) {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-booking-approval-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            recipientEmail: booking.requester_email,
            fullName: booking.requester_name,
            businessName: businessProfile.business_name,
            startDate: booking.start_date,
            endDate: booking.end_date,
            paymentStatus: booking.payment_status,
            paymentAmount: booking.payment_amount,
            businessAddress: businessProfile.contact_address, 
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Failed to send approval email:", errorData);
          toast({
            title: "Email Error",
            description: `Failed to send approval email: ${errorData.error || 'Unknown error'}`,
            variant: "destructive",
          });
          throw new Error(`Failed to send approval email: ${response.status}`);
        } else {
          toast({
            title: "Booking Approved",
            description: "Booking approved and confirmation email sent.",
          });
        }
      } else {
        console.warn("Supabase function URL or API key not found. Skipping email.");
        toast({
          title: "Booking Approved",
          description: "Booking approved, but email not sent (missing config).",
        });
      }
    } catch (error: any) {
      console.error("Error approving booking:", error);
      toast({
        title: "Approval Error",
        description: error.message || "Failed to approve booking",
        variant: "destructive",
      });
      // Revert the optimistic update on error
      queryClient.setQueryData<BookingRequest[]>(
        ["bookingRequests", { businessId: booking.business_id }],
        (old) =>
          old?.map((req) => (req.id === booking.id ? { ...req, status: "pending" } : req))
      );
      throw error;
    } finally {
      // Invalidate the query to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["bookingRequests", { businessId: booking.business_id }]
      });
    }
  };

  // Create a query hook for fetching booking requests
  const useBookingRequestsQuery = (params: BookingRequestParams = {}) => {
    return useQuery({
      queryKey: ["bookingRequests", params],
      queryFn: () => getBookingRequests(params),
    });
  };

  // Get all booking requests for the current business
  const { data: allRequests = [] } = useBookingRequestsQuery(
    businessProfile ? { businessId: businessProfile.id } : {}
  );

  // Filter requests by status
  const pendingRequests = allRequests.filter(req => req.status === "pending");
  const approvedRequests = allRequests.filter(req => req.status === "approved");
  const rejectedRequests = allRequests.filter(req => req.status === "rejected");

  // Function to reject a booking request
  const rejectRequest = async (id: string) => {
    await updateBookingRequestMutation.mutate({ id, updates: { status: "rejected" } });
  };

  // Create an adapter function that accepts a string ID and calls approveBooking with the full request object
  const approveRequestById = async (id: string) => {
    const request = allRequests.find(req => req.id === id);
    if (!request) {
      toast({
        title: "Error",
        description: "Booking request not found",
        variant: "destructive",
      });
      return;
    }
    
    await approveBookingMutation.mutate(request);
  };

  const createBookingRequestMutation = useMutation({
    mutationFn: createBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bookingRequests"]
      });
      toast({
        title: "Success",
        description: "Booking request created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create booking request",
        variant: "destructive",
      });
    },
  });

  const updateBookingRequestMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BookingRequest> }) =>
      updateBookingRequest(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bookingRequests"]
      });
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

  const deleteBookingRequestMutation = useMutation({
    mutationFn: deleteBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bookingRequests"]
      });
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

  const approveBookingMutation = useMutation({
    mutationFn: approveBooking,
  });

  return {
    // Return the query hook for components that need to fetch with custom params
    useBookingRequestsQuery,
    
    // Return mutation functions
    createBookingRequest: createBookingRequestMutation.mutate,
    updateBookingRequest: updateBookingRequestMutation.mutate,
    deleteBookingRequest: deleteBookingRequestMutation.mutate,
    approveBooking: approveBookingMutation.mutate,
    
    // Return pre-filtered request lists for convenience
    bookingRequests: allRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    
    // Return helper functions
    approveRequest: approveRequestById, // Now returns a function that takes a string ID
    rejectRequest,
  };
};
