
import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Check, Clock, Loader2, Mail, Phone, Trash2, X } from "lucide-react";
import { BookingRequest } from "@/types/database";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface BookingRequestsListProps {
  requests: BookingRequest[];
  type: "pending" | "approved" | "rejected";
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const BookingRequestsList = ({
  requests,
  type,
  onApprove,
  onReject,
  onDelete,
}: BookingRequestsListProps) => {
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);

  const handleApprove = async (request: BookingRequest) => {
    if (!onApprove) return;
    
    try {
      setProcessingId(request.id);
      
      // First, approve the request
      await onApprove(request.id);
      
      // Then, create an event in the events table to ensure synchronization
      await supabase.from("events").insert({
        title: request.title,
        start_date: request.start_date,
        end_date: request.end_date,
        event_notes: request.description,
        user_surname: request.requester_name,
        user_number: request.requester_phone,
        social_network_link: request.requester_email,
        business_id: request.business_id,
        type: "private_party" // Default type, change as needed
      });
      
      toast({
        title: "Request Approved",
        description: "The booking request has been approved and added to your calendar.",
      });
    } catch (error: any) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while approving the request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!onReject) return;
    
    try {
      setProcessingId(id);
      await onReject(id);
      toast({
        title: "Request Rejected",
        description: "The booking request has been rejected.",
      });
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while rejecting the request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = (id: string) => {
    setRequestToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!requestToDelete) return;
    
    try {
      setProcessingId(requestToDelete);
      await onDelete(requestToDelete);
      toast({
        title: "Request Deleted",
        description: "The booking request has been deleted.",
      });
    } catch (error: any) {
      console.error("Error deleting request:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while deleting the request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p>No {type} booking requests found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id} className="p-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {type === "pending" && <Clock className="h-4 w-4 text-amber-500" />}
                {type === "approved" && <Check className="h-4 w-4 text-green-500" />}
                {type === "rejected" && <X className="h-4 w-4 text-red-500" />}
                <h3 className="font-semibold">{request.title}</h3>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {format(new Date(request.start_date), "PPP")}
                </p>
                <p>
                  <span className="font-medium">Time:</span>{" "}
                  {format(new Date(request.start_date), "p")} - {format(new Date(request.end_date), "p")}
                </p>
              </div>
              
              {request.description && (
                <div className="text-sm mt-2">
                  <p className="font-medium">Details:</p>
                  <p className="text-muted-foreground">{request.description}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-sm">
                <p className="font-medium">{request.requester_name}</p>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{request.requester_email}</span>
                </div>
                {request.requester_phone && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{request.requester_phone}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 justify-end">
                {type === "pending" && onApprove && onReject && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleReject(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      <span className="hidden sm:inline">Reject</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      <span className="hidden sm:inline">Approve</span>
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(request.id)}
                  disabled={processingId === request.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the booking request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {processingId && processingId === requestToDelete ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
