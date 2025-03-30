
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { BookingRequestsList } from "./BookingRequestsList";
import { LoaderCircle, Globe } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export const BusinessPage = () => {
  const { businessProfile, isLoading } = useBusinessProfile();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  
  const { 
    pendingRequests, 
    approvedRequests, 
    rejectedRequests,
    isLoading: isLoadingRequests,
    approveRequest,
    rejectRequest,
    deleteBookingRequest
  } = useBookingRequests(businessProfile?.id);

  const copyPublicUrl = () => {
    if (!businessProfile?.slug) return;
    
    const url = `${window.location.origin}/business/${businessProfile.slug}`;
    navigator.clipboard.writeText(url);
    
    toast({
      title: "URL Copied",
      description: "Public business page URL copied to clipboard",
    });
  };

  const visitPublicPage = () => {
    if (!businessProfile?.slug) return;
    
    const url = `${window.location.origin}/business/${businessProfile.slug}`;
    window.open(url, "_blank");
  };

  // Wrapper functions to ensure Promise<void> return types
  const handleApproveRequest = async (id: string): Promise<void> => {
    await approveRequest(id);
  };

  const handleRejectRequest = async (id: string): Promise<void> => {
    await rejectRequest(id);
  };

  const handleDeleteRequest = async (id: string): Promise<void> => {
    await deleteBookingRequest(id);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {businessProfile && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">{businessProfile.business_name}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Public URL: {window.location.origin}/business/{businessProfile.slug}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyPublicUrl} size="sm">
                  Copy URL
                </Button>
                <Button onClick={visitPublicPage} size="sm" className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  Visit Public Page
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Business Profile</TabsTrigger>
          <TabsTrigger value="bookings" disabled={!businessProfile}>
            Booking Requests
            {pendingRequests && pendingRequests.length > 0 && (
              <span className="ml-2 bg-red-500 text-white rounded-full text-xs px-2 py-0.5">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <BusinessProfileForm />
        </TabsContent>

        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>Booking Requests</CardTitle>
              <CardDescription>
                Manage booking requests from your customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRequests ? (
                <div className="flex justify-center items-center p-8">
                  <LoaderCircle className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Tabs defaultValue="pending">
                  <TabsList className="mb-4">
                    <TabsTrigger value="pending">
                      Pending
                      {pendingRequests.length > 0 && (
                        <span className="ml-2 bg-red-500 text-white rounded-full text-xs px-2 py-0.5">
                          {pendingRequests.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="approved">
                      Approved
                      <span className="ml-2 bg-green-500 text-white rounded-full text-xs px-2 py-0.5">
                        {approvedRequests.length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="rejected">
                      Rejected
                      <span className="ml-2 bg-gray-500 text-white rounded-full text-xs px-2 py-0.5">
                        {rejectedRequests.length}
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pending">
                    <BookingRequestsList
                      requests={pendingRequests}
                      type="pending"
                      onApprove={handleApproveRequest}
                      onReject={handleRejectRequest}
                      onDelete={handleDeleteRequest}
                    />
                  </TabsContent>

                  <TabsContent value="approved">
                    <BookingRequestsList
                      requests={approvedRequests}
                      type="approved"
                      onDelete={handleDeleteRequest}
                    />
                  </TabsContent>

                  <TabsContent value="rejected">
                    <BookingRequestsList
                      requests={rejectedRequests}
                      type="rejected"
                      onDelete={handleDeleteRequest}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
