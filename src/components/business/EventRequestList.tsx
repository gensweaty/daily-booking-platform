
import React from "react";
import { EventRequest } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { CheckCircle, XCircle, Clock, User, Phone, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

interface EventRequestListProps {
  eventRequests: EventRequest[];
  isLoading: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export const EventRequestList = ({
  eventRequests,
  isLoading,
  onApprove,
  onReject,
}: EventRequestListProps) => {
  const { t, language } = useLanguage();
  const locale = language === 'es' ? es : undefined;
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Booking Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex flex-col space-y-3 p-4 border rounded-md">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex justify-end gap-2 mt-2">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingRequests = eventRequests.filter(
    (request) => request.status === "pending"
  );

  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Booking Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p>No pending booking requests</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Booking Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <div
              key={request.id}
              className="p-4 border rounded-md bg-muted/30 hover:bg-muted transition-colors"
            >
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-lg">{request.title}</h3>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                </div>
                
                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(request.start_date), "PPP p", { locale })} - 
                  {format(parseISO(request.end_date), "p", { locale })}
                </div>
                
                {request.user_surname && (
                  <div className="text-sm flex items-center gap-1.5">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {request.user_surname}
                  </div>
                )}
                
                {request.user_number && (
                  <div className="text-sm flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {request.user_number}
                  </div>
                )}
                
                {request.event_notes && (
                  <div className="text-sm mt-2 bg-muted p-2 rounded">
                    {request.event_notes}
                  </div>
                )}
                
                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReject(request.id)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onApprove(request.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
