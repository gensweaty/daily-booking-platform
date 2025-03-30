
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { CheckCircle, XCircle, Calendar, Mail, Phone, MessageSquare, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { updateBookingRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BookingRequestsListProps {
  businessId: string;
  refresh?: boolean;
}

export const BookingRequestsList = ({ businessId, refresh }: BookingRequestsListProps) => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      console.log(`Fetched ${data.length} booking requests:`, data);
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching booking requests:", error);
      toast({
        title: "Error",
        description: "Failed to load booking requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      fetchRequests();
    }
  }, [businessId, refresh]);

  // Set up real-time updates
  useEffect(() => {
    if (!businessId) return;
    
    const channel = supabase
      .channel('booking_requests_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'booking_requests',
        filter: `business_id=eq.${businessId}`
      }, () => {
        fetchRequests();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      
      console.log(`Approving booking request: ${id}`);
      await updateBookingRequest(id, { status: "approved" });
      
      toast({
        title: "Request Approved",
        description: "The booking request has been approved and added to your calendar."
      });
      
      // Optimistically update the UI
      setRequests(prev => 
        prev.map(req => 
          req.id === id ? { ...req, status: "approved" } : req
        )
      );
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description: "Failed to approve booking request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessingId(id);
      
      console.log(`Rejecting booking request: ${id}`);
      await updateBookingRequest(id, { status: "rejected" });
      
      toast({
        title: "Request Rejected",
        description: "The booking request has been rejected."
      });
      
      // Optimistically update the UI
      setRequests(prev => 
        prev.map(req => 
          req.id === id ? { ...req, status: "rejected" } : req
        )
      );
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description: "Failed to reject booking request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-40 bg-muted/20"></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!requests.length) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center h-40 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium">No Booking Requests Yet</h3>
          <p className="text-muted-foreground mt-2">
            Booking requests from your public page will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const startDate = parseISO(request.start_date);
        const endDate = parseISO(request.end_date);
        
        return (
          <Card key={request.id} className={cn(
            "overflow-hidden",
            request.status === "approved" && "border-green-200 bg-green-50",
            request.status === "rejected" && "border-red-200 bg-red-50"
          )}>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-medium">{request.title}</h3>
                    {getStatusBadge(request.status)}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(startDate, "PPP")} • {format(startDate, "p")} - {format(endDate, "p")}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">From:</span> {request.requester_name}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${request.requester_email}`} className="hover:underline text-blue-600">
                        {request.requester_email}
                      </a>
                    </div>
                    
                    {request.requester_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${request.requester_phone}`} className="hover:underline text-blue-600">
                          {request.requester_phone}
                        </a>
                      </div>
                    )}
                    
                    {request.description && (
                      <div className="flex gap-2 text-sm mt-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                        <p className="text-muted-foreground">{request.description}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {request.status === "pending" && (
                  <div className="flex sm:flex-col gap-2 mt-4 sm:mt-0">
                    <Button
                      onClick={() => handleApprove(request.id)}
                      disabled={!!processingId}
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(request.id)}
                      disabled={!!processingId}
                      variant="destructive"
                      className="w-full sm:w-auto"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
