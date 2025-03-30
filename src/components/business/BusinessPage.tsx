
import { useState, useEffect } from "react";
import { BusinessProfile } from "./BusinessProfile";
import { BusinessCalendar } from "./BusinessCalendar";
import { EventRequestsTable } from "./EventRequestsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, ClipboardList, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getBusiness } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Business } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Button } from "../ui/button";

export const BusinessPage = () => {
  const { data: business, isLoading } = useQuery({
    queryKey: ['business'],
    queryFn: getBusiness,
  });

  const { toast } = useToast();
  const [publicUrl, setPublicUrl] = useState("");

  useEffect(() => {
    if (business?.slug) {
      const baseUrl = window.location.origin;
      setPublicUrl(`${baseUrl}/business/${business.slug}`);
    }
  }, [business]);

  const handleCopyLink = () => {
    toast({
      title: "Link copied!",
      description: "Public calendar link copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-semibold mb-4">Business Profile</h2>
        <p className="text-muted-foreground">
          You haven't set up your business profile yet.
        </p>
        <BusinessProfile />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-semibold">My Business</h2>
        {business?.slug && (
          <CopyToClipboard text={publicUrl} onCopy={handleCopyLink}>
            <Button variant="outline" className="flex gap-2 items-center">
              <Store className="w-4 h-4" />
              Copy Public Calendar Link
            </Button>
          </CopyToClipboard>
        )}
      </div>
      
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="flex gap-2">
            <Store className="w-4 h-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex gap-2">
            <CalendarIcon className="w-4 h-4" />
            <span>Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex gap-2">
            <ClipboardList className="w-4 h-4" />
            <span>Booking Requests</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <BusinessProfile existingBusiness={business} />
        </TabsContent>
        
        <TabsContent value="calendar">
          {business?.id && <BusinessCalendar businessId={business.id} />}
        </TabsContent>
        
        <TabsContent value="requests">
          {business?.id && <EventRequestsTable businessId={business.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};
