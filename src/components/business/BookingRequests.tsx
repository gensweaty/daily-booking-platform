
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Check, X, FileText } from "lucide-react";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

interface BookingRequestsProps {
  businessId: string;
}

export const BookingRequests = ({ businessId }: BookingRequestsProps) => {
  const {
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    isLoading,
    approveRequest,
    rejectRequest,
  } = useBookingRequests(businessId);
  
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const selectedRequest = [...pendingRequests, ...approvedRequests, ...rejectedRequests]
    .find(request => request.id === selectedRequestId);

  const renderRequestList = (requests: any[], status: string) => {
    if (isLoading) {
      return Array(3).fill(0).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
        </TableRow>
      ));
    }
    
    if (requests.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center py-6">
            <p className="text-muted-foreground">No {status} booking requests</p>
          </TableCell>
        </TableRow>
      );
    }
    
    return requests.map((request) => (
      <TableRow key={request.id}>
        <TableCell>
          <div className="font-medium">{request.requester_name}</div>
          <div className="text-sm text-muted-foreground">{request.requester_email}</div>
        </TableCell>
        <TableCell>{request.title || "No title"}</TableCell>
        <TableCell>
          {new Date(request.start_date).toLocaleDateString()} at{" "}
          {new Date(request.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </TableCell>
        <TableCell>
          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSelectedRequestId(request.id);
                setViewDialogOpen(true);
              }}
            >
              <FileText className="h-4 w-4 mr-1" />
              View
            </Button>
            
            {status === 'pending' && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50"
                  onClick={() => approveRequest(request.id)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                  onClick={() => rejectRequest(request.id)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    ));
  }; 

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Booking Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList className="mb-4">
              <TabsTrigger value="pending">
                Pending
                {pendingRequests.length > 0 && (
                  <Badge className="ml-2 bg-yellow-500">{pendingRequests.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved
                {approvedRequests.length > 0 && (
                  <Badge className="ml-2 bg-green-500">{approvedRequests.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected
                {rejectedRequests.length > 0 && (
                  <Badge className="ml-2 bg-red-500">{rejectedRequests.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Requested Time</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderRequestList(pendingRequests, 'pending')}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="approved">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderRequestList(approvedRequests, 'approved')}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="rejected">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Requested Time</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderRequestList(rejectedRequests, 'rejected')}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Request Details</DialogTitle>
            <DialogDescription>
              {selectedRequest?.requester_name}'s booking request
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm">Requester</h3>
                <p>{selectedRequest.requester_name}</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.requester_email}</p>
                {selectedRequest.requester_phone && (
                  <p className="text-sm text-muted-foreground">{selectedRequest.requester_phone}</p>
                )}
              </div>
              
              <div>
                <h3 className="font-semibold text-sm">Title</h3>
                <p>{selectedRequest.title || "No title"}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-sm">Time</h3>
                <p>
                  {new Date(selectedRequest.start_date).toLocaleDateString()}, {" "}
                  {new Date(selectedRequest.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {" to "}
                  {new Date(selectedRequest.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              
              {selectedRequest.notes && (
                <div>
                  <h3 className="font-semibold text-sm">Notes</h3>
                  <p className="whitespace-pre-wrap">{selectedRequest.notes}</p>
                </div>
              )}
              
              {selectedRequest.file_url && (
                <div>
                  <h3 className="font-semibold text-sm">Attached File</h3>
                  <a 
                    href={selectedRequest.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center text-blue-600 hover:underline"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    View Attachment
                  </a>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                {selectedRequest.status === 'pending' && (
                  <>
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        approveRequest(selectedRequest.id);
                        setViewDialogOpen(false);
                      }}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={() => {
                        rejectRequest(selectedRequest.id);
                        setViewDialogOpen(false);
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedRequest.status === 'approved' && (
                  <Badge className="bg-green-500 px-2 py-1">Approved</Badge>
                )}
                {selectedRequest.status === 'rejected' && (
                  <Badge className="bg-red-500 px-2 py-1">Rejected</Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
