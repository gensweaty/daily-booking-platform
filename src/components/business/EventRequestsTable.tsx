
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Check, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface EventRequestsTableProps {
  businessId: string;
}

interface EventRequest {
  id: string;
  title: string;
  user_name: string;
  user_surname: string;
  user_email: string;
  user_number?: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  social_network_link?: string;
  event_notes?: string;
  type?: string;
  payment_status?: 'pending' | 'paid' | 'failed';
  payment_amount?: number;
}

export const EventRequestsTable = ({ businessId }: EventRequestsTableProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  
  // Fetch event requests
  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: ['event-requests', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('event_requests')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error("Error fetching event requests:", error);
        throw error;
      }
      
      return data as EventRequest[];
    },
    enabled: !!businessId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Filter requests based on active tab
  const filteredRequests = requests?.filter(request => request.status === activeTab) || [];

  // Update request status
  const updateRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const { data, error } = await supabase
        .from('event_requests')
        .update({ status })
        .eq('id', requestId)
        .select()
        .single();
        
      if (error) throw error;
      
      toast({
        title: `Request ${status}`,
        description: `The booking request has been ${status}.`,
      });
      
      // Refetch data
      refetch();
      
    } catch (error) {
      console.error("Error updating request status:", error);
      toast({
        title: "Error",
        description: "Failed to update the request status. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p>Error loading booking requests. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tab navigation */}
        <div className="flex space-x-1 mb-6 bg-muted rounded-md p-1">
          <Button 
            variant={activeTab === 'pending' ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab('pending')}
            className="flex-1"
          >
            Pending ({requests?.filter(r => r.status === 'pending').length || 0})
          </Button>
          <Button 
            variant={activeTab === 'approved' ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab('approved')}
            className="flex-1"
          >
            Approved ({requests?.filter(r => r.status === 'approved').length || 0})
          </Button>
          <Button 
            variant={activeTab === 'rejected' ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab('rejected')}
            className="flex-1"
          >
            Rejected ({requests?.filter(r => r.status === 'rejected').length || 0})
          </Button>
        </div>

        {/* Request list */}
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No {activeTab} booking requests found.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div 
                key={request.id} 
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-medium">{request.title}</h3>
                  <Badge variant={
                    request.status === 'approved' ? 'default' :
                    request.status === 'rejected' ? 'destructive' : 'outline'
                  }>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {/* Client info */}
                  <div>
                    <p className="text-sm font-medium">Client</p>
                    <p className="text-sm">{request.user_name} {request.user_surname}</p>
                    <p className="text-sm text-muted-foreground">{request.user_email}</p>
                    {request.user_number && (
                      <p className="text-sm">{request.user_number}</p>
                    )}
                  </div>
                  
                  {/* Event time */}
                  <div className="flex items-center gap-1 text-sm">
                    <CalendarClock className="h-4 w-4" />
                    <span>
                      {format(new Date(request.start_date), "MMM d, yyyy h:mm a")} - 
                      {format(new Date(request.end_date), "h:mm a")}
                    </span>
                  </div>
                  
                  {/* Notes if available */}
                  {request.event_notes && (
                    <div className="bg-muted p-2 rounded-md">
                      <p className="text-sm font-medium">Notes</p>
                      <p className="text-sm">{request.event_notes}</p>
                    </div>
                  )}
                </div>
                
                {/* Actions for pending requests */}
                {request.status === 'pending' && (
                  <div className="flex space-x-2 pt-2">
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => updateRequestStatus(request.id, 'approved')}
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => updateRequestStatus(request.id, 'rejected')}
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
