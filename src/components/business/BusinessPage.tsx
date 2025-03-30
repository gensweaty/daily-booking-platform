
import { BusinessProfileForm } from "./BusinessProfileForm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BookingRequestsList } from "./BookingRequestsList";
import { useBookingRequests } from "@/hooks/useBookingRequests";

export const BusinessPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const { bookingRequests, pendingRequests, approvedRequests, rejectedRequests, approveRequest, rejectRequest, deleteBookingRequest } = useBookingRequests();

  const { data: businessProfile, isLoading } = useQuery({
    queryKey: ["businessProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  const publicUrl = businessProfile?.slug 
    ? `${window.location.protocol}//${window.location.host}/business/${businessProfile.slug}`
    : null;

  return (
    <div className="space-y-6">
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Business Profile</TabsTrigger>
          <TabsTrigger value="bookings">Booking Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">My Business Profile</h1>
            {publicUrl && (
              <Button 
                variant="outline"
                onClick={() => window.open(publicUrl, '_blank')}
              >
                View Public Page
              </Button>
            )}
          </div>

          <BusinessProfileForm />
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <h1 className="text-2xl font-bold">Booking Requests</h1>

          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Pending Requests ({pendingRequests.length})</h2>
              <BookingRequestsList
                requests={pendingRequests}
                type="pending"
                onApprove={approveRequest}
                onReject={rejectRequest}
                onDelete={deleteBookingRequest}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Approved Requests ({approvedRequests.length})</h2>
              <BookingRequestsList
                requests={approvedRequests}
                type="approved"
                onDelete={deleteBookingRequest}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Rejected Requests ({rejectedRequests.length})</h2>
              <BookingRequestsList
                requests={rejectedRequests}
                type="rejected"
                onDelete={deleteBookingRequest}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
