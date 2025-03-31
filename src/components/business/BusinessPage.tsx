import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Calendar } from "@/components/Calendar/Calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BusinessProfile as BusinessProfileType } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { BusinessProfile } from "./BusinessProfile";
import { Statistics } from "./Statistics";
import { BookingRequests } from "./BookingRequests";
import { BookingRequestNotifications } from "./BookingRequestNotifications";

interface Params {
  slug: string;
}

export const BusinessPage = () => {
  const { slug } = useParams<Params>();
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBusinessProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (!slug) throw new Error("Business slug is required");
        const { data, error } = await supabase
          .from("business_profiles")
          .select("*")
          .eq("slug", slug)
          .single();

        if (error) throw error;

        setBusinessProfile(data);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinessProfile();
  }, [slug]);

  if (isLoading) {
    return (
      <Card className="min-h-[calc(100vh-12rem)]">
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="min-h-[calc(100vh-12rem)]">
        <CardContent className="p-6">
          <p className="text-center text-red-500">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!businessProfile) {
    return (
      <Card className="min-h-[calc(100vh-12rem)]">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Business not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="profile" className="space-y-4 min-h-[calc(100vh-12rem)]">
      <Card>
        <CardHeader>
          <CardTitle>{businessProfile.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="booking-requests" className="flex items-center gap-2">
              Booking Requests
              {businessProfile?.id && <BookingRequestNotifications businessId={businessProfile.id} />}
            </TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
          </TabsList>
        </CardContent>
      </Card>

      <TabsContent value="profile" className="space-y-10">
        <BusinessProfile businessProfile={businessProfile} />
      </TabsContent>
      <TabsContent value="calendar" className="space-y-10">
        <Card>
          <CardContent className="p-0">
            <Calendar
              isExternalCalendar={true}
              businessId={businessProfile.id}
              businessUserId={businessProfile.user_id}
              allowBookingRequests={true}
            />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="booking-requests" className="space-y-10">
        <BookingRequests businessId={businessProfile.id} />
      </TabsContent>
      <TabsContent value="statistics" className="space-y-10">
        <Statistics businessProfile={businessProfile} />
      </TabsContent>
    </Tabs>
  );
};
