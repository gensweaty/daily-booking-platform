
import { BusinessProfileForm } from "./BusinessProfileForm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BookingRequestsList } from "./BookingRequestsList";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

export const BusinessPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "bookings">("profile");
  const { bookingRequests, pendingRequests, approvedRequests, rejectedRequests, approveRequest, rejectRequest, deleteBookingRequest } = useBookingRequests();
  const pendingCount = pendingRequests?.length || 0;

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

  // Auto-select "bookings" if profile exists, "profile" if not
  useEffect(() => {
    if (businessProfile) {
      setActiveTab("bookings");
    } else {
      setActiveTab("profile");
    }
  }, [businessProfile]);

  if (isLoading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  const publicUrl = businessProfile?.slug 
    ? `${window.location.protocol}//${window.location.host}/business/${businessProfile.slug}`
    : null;

  // Create a type-safe handler for tab changes
  const handleTabChange = (value: string) => {
    if (value === "profile" || value === "bookings") {
      setActiveTab(value);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Business Profile</TabsTrigger>
          <TabsTrigger value="bookings" className="relative">
            Booking Requests
            {pendingCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 flex items-center justify-center h-5 min-w-5 p-0 text-xs"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Booking Requests</h1>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-1 rounded-full">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">{pendingCount} new {pendingCount === 1 ? 'request' : 'requests'}</span>
              </div>
            )}
          </div>

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
