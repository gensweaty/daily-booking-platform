
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

export const useBookingRequests = () => {
  const { user } = useAuth();
  
  const fetchPendingRequests = async () => {
    if (!user) return [];
    
    try {
      // Get the user's business profile
      const { data: businessProfile, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (businessError || !businessProfile) {
        console.error("Error fetching business profile:", businessError);
        return [];
      }
      
      // Get pending booking requests
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Error fetching pending booking requests:", error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error("Error in fetchPendingRequests:", error);
      return [];
    }
  };
  
  const { data: pendingRequests, isLoading, error, refetch } = useQuery({
    queryKey: ['pending-booking-requests', user?.id],
    queryFn: fetchPendingRequests,
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
  
  useEffect(() => {
    if (!user) return;
    
    // Set up real-time subscription for booking request changes
    const channel = supabase
      .channel('booking-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests'
        },
        () => {
          refetch();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);
  
  return {
    pendingRequests,
    isLoading,
    error,
    refetch
  };
};
