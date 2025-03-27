import { useBusiness } from "@/hooks/useBusiness";
import { useEventRequests } from "@/hooks/useEventRequests";
import { Business, EventRequest } from "@/lib/types/business";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { PlusCircle } from "lucide-react";
import { BusinessDialog } from "./BusinessDialog";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { EventRequestDialog } from "../Calendar/EventRequestDialog";

export const BusinessTab = () => {
  const { t } = useLanguage();
  const { business, hasBusiness, isLoading } = useBusiness();
  const { eventRequests, pendingRequests } = useEventRequests(business?.id);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const handleCopyLink = () => {
    if (!business) return;
    
    const url = `${window.location.origin}/${business.slug}`;
    navigator.clipboard.writeText(url);
    
    toast({
      title: "Link Copied",
      description: "Business page link copied to clipboard!",
    });
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      );
    }
    
    if (!hasBusiness) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground" />
          <h3 className="text-xl font-semibold">No Business Added Yet</h3>
          <p className="text-muted-foreground max-w-md">
            Add your business to create a public booking page where clients can request appointments.
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            Add Business
          </Button>
        </div>
      );
    }
    
    return (
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Business Details</TabsTrigger>
          <TabsTrigger value="requests">
            Event Requests
            {pendingRequests?.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{business?.name}</h2>
              <p className="text-muted-foreground">
                Created {format(new Date(business?.created_at), "PPP")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="flex items-center gap-1"
              >
                <Share2 className="h-4 w-4" />
                Copy Link
              </Button>
              <Button
                size="sm"
                onClick={() => setIsDialogOpen(true)}
              >
                Edit Business
              </Button>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {business?.description || "No description provided"}
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm">{business?.contact_phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm">{business?.contact_email || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm">{business?.contact_address || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Website</p>
                    <p className="text-sm">{business?.contact_website || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Public Page Preview</h3>
              {business?.cover_photo_path ? (
                <div className="relative h-48 rounded-lg overflow-hidden mb-4">
                  <img
                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business_photos/${business.cover_photo_path}`}
                    alt={business.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-48 bg-muted rounded-lg flex items-center justify-center mb-4">
                  <p className="text-muted-foreground">No cover photo</p>
                </div>
              )}
              
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm">
                  Your public page is available at:
                </p>
                <div className="flex mt-2">
                  <code className="flex-1 bg-muted p-2 rounded text-sm overflow-x-auto">
                    {window.location.origin}/{business?.slug}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                    className="ml-2"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="requests">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Event Requests</h2>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {pendingRequests?.length || 0} pending requests
                </span>
              </div>
            </div>
            
            {eventRequests?.length === 0 ? (
              <div className="bg-muted/30 border rounded-lg p-6 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <h3 className="font-medium text-lg">No Event Requests Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-1">
                  When clients request events from your public page, they will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Pending Requests</h3>
                    <div className="grid gap-2">
                      {pendingRequests.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    );
  };
  
  return (
    <>
      <Card className="min-h-[calc(100vh-12rem)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Business Management</CardTitle>
              <CardDescription>
                Manage your business and event requests
              </CardDescription>
            </div>
            {!hasBusiness && (
              <Button onClick={() => setIsDialogOpen(true)}>
                Add Business
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
      
      <BusinessDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        business={business || undefined}
      />
    </>
  );
};

interface RequestCardProps {
  request: EventRequest;
}

const RequestCard = ({ request }: RequestCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium">{request.title}</h4>
              <p className="text-sm text-muted-foreground">
                {format(new Date(request.start_date), "PPP p")} - {format(new Date(request.end_date), "p")}
              </p>
              <p className="text-sm mt-1">
                From: {request.user_surname || "No name"} 
                {request.user_number && ` • ${request.user_number}`}
              </p>
            </div>
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {isDialogOpen && (
        <EventRequestDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          eventRequest={request}
        />
      )}
    </>
  );
};
