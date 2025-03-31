
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BookingRequest = {
  id: string;
  business_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  start_time: string;
  end_time: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  title: string;
  description?: string;
};

type BookingRequestsProps = {
  businessId: string;
};

export const BookingRequests = ({ businessId }: BookingRequestsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: bookingRequests, isLoading, error } = useQuery({
    queryKey: ["bookingRequests", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BookingRequest[];
    },
    enabled: !!businessId,
  });

  const updateRequestStatusMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string;
      status: "approved" | "rejected";
    }) => {
      const { data, error } = await supabase
        .from("booking_requests")
        .update({ status })
        .eq("id", requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bookingRequests", businessId] });
      toast({
        title: `Booking ${data.status}`,
        description: `The booking request has been ${data.status}.`,
      });

      // If approved, create a calendar event
      if (data.status === "approved") {
        createCalendarEventMutation.mutate({
          requestId: data.id,
        });
      }
      
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update booking status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const createCalendarEventMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      // First, get the request details
      const { data: request, error: requestError } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      // Create a calendar event
      const { data, error } = await supabase
        .from("events")
        .insert({
          business_id: request.business_id,
          title: request.title,
          description: request.description || "",
          start_time: request.start_time,
          end_time: request.end_time,
          user_id: request.user_id,
          created_at: new Date().toISOString(),
          booking_request_id: request.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create customer record if needed
      await createOrUpdateCustomer(request);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Event created",
        description: "A new event has been added to your calendar.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create event: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const createOrUpdateCustomer = async (request: BookingRequest) => {
    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("*")
      .eq("email", request.customer_email)
      .eq("business_id", request.business_id)
      .maybeSingle();

    if (existingCustomer) {
      // Update existing customer
      await supabase
        .from("customers")
        .update({
          last_booking: new Date().toISOString(),
          bookings_count: (existingCustomer.bookings_count || 0) + 1,
        })
        .eq("id", existingCustomer.id);
    } else {
      // Create new customer
      await supabase.from("customers").insert({
        business_id: request.business_id,
        name: request.customer_name,
        email: request.customer_email,
        phone: request.customer_phone || "",
        created_at: new Date().toISOString(),
        last_booking: new Date().toISOString(),
        bookings_count: 1,
      });
    }
  };

  const handleViewRequest = (request: BookingRequest) => {
    setSelectedRequest(request);
    setIsDialogOpen(true);
  };

  const handleUpdateStatus = (status: "approved" | "rejected") => {
    if (selectedRequest) {
      updateRequestStatusMutation.mutate({
        requestId: selectedRequest.id,
        status,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-red-500">
            Error loading booking requests: {(error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const pendingRequests = bookingRequests?.filter((req) => req.status === "pending") || [];
  const pastRequests = bookingRequests?.filter((req) => req.status !== "pending") || [];

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Booking Requests</CardTitle>
          <CardDescription>
            Manage booking requests from customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Pending Requests ({pendingRequests.length})</h3>
              {pendingRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm">No pending requests</p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{request.title}</h4>
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                Pending
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {request.customer_name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {request.customer_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {request.customer_email}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm">
                              {format(
                                new Date(request.start_time),
                                "MMM d, yyyy h:mm a"
                              )} - {format(
                                new Date(request.end_time),
                                "h:mm a"
                              )}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 mt-4 md:mt-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewRequest(request)}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Past Requests ({pastRequests.length})</h3>
              {pastRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm">No past requests</p>
              ) : (
                <div className="space-y-4">
                  {pastRequests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{request.title}</h4>
                              <Badge
                                variant="outline"
                                className={
                                  request.status === "approved"
                                    ? "bg-green-100 text-green-800 border-green-300"
                                    : "bg-red-100 text-red-800 border-red-300"
                                }
                              >
                                {request.status.charAt(0).toUpperCase() +
                                  request.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {request.customer_name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {request.customer_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {request.customer_email}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm">
                              {format(
                                new Date(request.start_time),
                                "MMM d, yyyy h:mm a"
                              )} - {format(
                                new Date(request.end_time),
                                "h:mm a"
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {selectedRequest && (
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Booking Request Details</DialogTitle>
              <DialogDescription>
                Review the details of this booking request
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Status</p>
                <Badge
                  variant="outline"
                  className={
                    selectedRequest.status === "pending"
                      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                      : selectedRequest.status === "approved"
                      ? "bg-green-100 text-green-800 border-green-300"
                      : "bg-red-100 text-red-800 border-red-300"
                  }
                >
                  {selectedRequest.status.charAt(0).toUpperCase() +
                    selectedRequest.status.slice(1)}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Title</p>
                <p>{selectedRequest.title}</p>
              </div>
              
              {selectedRequest.description && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
              )}
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Customer Information</p>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {selectedRequest.customer_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {selectedRequest.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedRequest.customer_email}
                    </p>
                    {selectedRequest.customer_phone && (
                      <p className="text-xs text-muted-foreground">
                        {selectedRequest.customer_phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Date and Time</p>
                <p>
                  {format(
                    new Date(selectedRequest.start_time),
                    "MMMM d, yyyy"
                  )}
                </p>
                <p>
                  {format(
                    new Date(selectedRequest.start_time),
                    "h:mm a"
                  )} - {format(
                    new Date(selectedRequest.end_time),
                    "h:mm a"
                  )}
                </p>
              </div>
              
              {/* Add file attachment display here if needed */}
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Created At</p>
                <p>
                  {format(
                    new Date(selectedRequest.created_at),
                    "MMMM d, yyyy h:mm a"
                  )}
                </p>
              </div>
            </div>
            
            {selectedRequest.status === "pending" && (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleUpdateStatus("rejected")}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => handleUpdateStatus("approved")}
                >
                  Approve
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
};
