
import { format } from "date-fns";
import { BookingRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Trash2, AlertCircle, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface BookingRequestsListProps {
  requests: BookingRequest[];
  type: "pending" | "approved" | "rejected";
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete: (id: string) => void;
}

export const BookingRequestsList = ({
  requests,
  type,
  onApprove,
  onReject,
  onDelete,
}: BookingRequestsListProps) => {
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDeleteConfirm = () => {
    if (requestToDelete) {
      onDelete(requestToDelete);
      setRequestToDelete(null);
    }
  };

  const handleApprove = async (id: string) => {
    if (!onApprove) return;
    
    try {
      setProcessingId(id);
      await onApprove(id);
      toast({
        title: "Success",
        description: "Booking approved. Email notification has been processed.",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error approving booking:", error);
      toast({
        title: "Error",
        description: "There was a problem approving the booking. Please try again.",
        variant: "destructive",
        duration: 5000,
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
    } catch (error) {
      console.error("Error rejecting booking:", error);
      toast({
        title: "Error",
        description: "There was a problem rejecting the booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 border rounded-md bg-muted/20">
        <div className="flex justify-center">
          {type === "pending" ? (
            <Clock className="h-12 w-12 text-muted-foreground" />
          ) : type === "approved" ? (
            <CheckCircle className="h-12 w-12 text-muted-foreground" />
          ) : (
            <XCircle className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        <h3 className="mt-4 text-lg font-medium">No {type} booking requests</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {type === "pending"
            ? "When customers make booking requests, they'll appear here for your approval."
            : type === "approved"
            ? "Approved booking requests will appear here."
            : "Rejected booking requests will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Date & Time</TableHead>
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{request.requester_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {request.requester_email}
                    {request.requester_phone && ` • ${request.requester_phone}`}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button variant="ghost" className="p-0 font-normal text-left">
                      {request.title}
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div>
                      <h4 className="font-semibold mb-2">{request.title}</h4>
                      {request.description ? (
                        <p className="text-sm">{request.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No description provided</p>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {format(new Date(request.start_date), "MMM dd, yyyy")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(request.start_date), "h:mm a")} -{" "}
                    {format(new Date(request.end_date), "h:mm a")}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {type === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex gap-1 text-green-600 hover:text-green-700"
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                      >
                        {processingId === request.id ? (
                          <span className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        <span className="sr-only sm:not-sr-only sm:inline">Approve</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex gap-1 text-red-600 hover:text-red-700"
                        onClick={() => handleReject(request.id)}
                        disabled={processingId === request.id}
                      >
                        <XCircle className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only sm:inline">Reject</span>
                      </Button>
                    </>
                  )}
                  <AlertDialog open={requestToDelete === request.id} onOpenChange={(open) => !open && setRequestToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex gap-1 hover:text-red-600"
                        onClick={() => setRequestToDelete(request.id)}
                        disabled={processingId === request.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only sm:inline">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Booking Request</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this booking request? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
