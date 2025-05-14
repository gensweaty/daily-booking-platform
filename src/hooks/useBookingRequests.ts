
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// Define BookingRequestType directly inside this file instead of importing
export interface BookingRequestType {
  id: string;
  business_id: string;
  user_id?: string;
  title: string;
  description?: string;
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  payment_amount?: number;
  payment_status?: string;
  language?: string;
  business_user_id?: string;
}

interface UseBookingRequestsProps {
  businessId?: string;
  userId?: string;
  isBusinessView?: boolean;
  isCustomerView?: boolean;
}

export const useBookingRequests = ({
  businessId,
  userId,
  isBusinessView = false,
  isCustomerView = false,
}: UseBookingRequestsProps) => {
  const [bookingRequests, setBookingRequests] = useState<BookingRequestType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const fetchBookingRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!businessId && !userId) {
      console.warn("Both businessId and userId are missing. Skipping fetch.");
      setLoading(false);
      return;
    }

    let query = supabase
      .from('booking_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (isBusinessView && user) {
      query = query.eq('business_user_id', user.id);
    }

    if (isCustomerView && user) {
      query = query.eq('user_id', user.id);
    }

    try {
      const { data, error } = await query;

      if (error) {
        console.error("Error fetching booking requests:", error);
        setError(error);
      } else {
        setBookingRequests(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching booking requests:", err);
      setError(new Error("Failed to fetch booking requests"));
    } finally {
      setLoading(false);
    }
  }, [businessId, userId, user, isBusinessView, isCustomerView]);

  useEffect(() => {
    fetchBookingRequests();
  }, [fetchBookingRequests]);

  // Create filtered arrays for pending, approved, and rejected requests
  const pendingRequests = bookingRequests.filter(request => request.status === 'pending');
  const approvedRequests = bookingRequests.filter(request => request.status === 'approved');
  const rejectedRequests = bookingRequests.filter(request => request.status === 'rejected');

  const createBookingRequest = async (newBookingRequest: Omit<BookingRequestType, 'id'>) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('booking_requests')
        .insert([newBookingRequest])
        .select()
        .single();

      if (error) {
        console.error("Error creating booking request:", error);
        setError(error);
        return null;
      } else {
        setBookingRequests(prevRequests => [data, ...prevRequests]);
        return data;
      }
    } catch (err) {
      console.error("Unexpected error creating booking request:", err);
      setError(new Error("Failed to create booking request"));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateBookingRequest = async (id: string, updates: Partial<BookingRequestType>) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('booking_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error("Error updating booking request:", error);
        setError(error);
        return null;
      } else {
        setBookingRequests(prevRequests =>
          prevRequests.map(request => (request.id === id ? { ...request, ...data } : request))
        );
        return data;
      }
    } catch (err) {
      console.error("Unexpected error updating booking request:", err);
      setError(new Error("Failed to update booking request"));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteBookingRequest = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('booking_requests')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Error deleting booking request:", error);
        setError(error);
        toast({
          title: "Error",
          description: "There was a problem deleting the booking request"
        });
        return false;
      } else {
        setBookingRequests(prevRequests => prevRequests.filter(request => request.id !== id));
        toast({
          title: "Success",
          description: "Booking request has been deleted"
        });
        return true;
      }
    } catch (err) {
      console.error("Unexpected error deleting booking request:", err);
      setError(new Error("Failed to delete booking request"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const approveBookingRequest = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      // Optimistically update the local state
      setBookingRequests(prevRequests =>
        prevRequests.map(request =>
          request.id === id ? { ...request, status: 'approved' } : request
        )
      );

      // Update the booking request status to 'approved' in the database
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) {
        console.error("Error approving booking request:", error);
        setError(error);

        // Revert the optimistic update if the database update fails
        setBookingRequests(prevRequests =>
          prevRequests.map(request =>
            request.id === id ? { ...request, status: 'pending' } : request
          )
        );
        toast({
          title: "Error",
          description: "There was a problem approving the booking request"
        });
        return false;
      } else {
        toast({
          title: "Success", 
          description: "Booking request has been approved"
        });
        return true;
      }
    } catch (err) {
      console.error("Unexpected error approving booking request:", err);
      setError(new Error("Failed to approve booking request"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const rejectBookingRequest = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      // Optimistically update the local state
      setBookingRequests(prevRequests =>
        prevRequests.map(request =>
          request.id === id ? { ...request, status: 'rejected' } : request
        )
      );

      // Update the booking request status to 'rejected' in the database
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) {
        console.error("Error rejecting booking request:", error);
        setError(error);

        // Revert the optimistic update if the database update fails
        setBookingRequests(prevRequests =>
          prevRequests.map(request =>
            request.id === id ? { ...request, status: 'pending' } : request
          )
        );
        toast({
          title: "Error",
          description: "There was a problem rejecting the booking request"
        });
        return false;
      } else {
        toast({
          title: "Success",
          description: "Booking request has been rejected"
        });
        return true;
      }
    } catch (err) {
      console.error("Unexpected error rejecting booking request:", err);
      setError(new Error("Failed to reject booking request"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    bookingRequests,
    loading,
    error,
    fetchBookingRequests,
    createBookingRequest,
    updateBookingRequest,
    deleteBookingRequest,
    approveBookingRequest,
    rejectBookingRequest,
    // Add the following properties for BusinessPage.tsx
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    // Aliases for consistent naming in BusinessPage.tsx
    approveRequest: approveBookingRequest,
    rejectRequest: rejectBookingRequest
  };
};
