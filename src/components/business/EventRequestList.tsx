
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { EventRequest } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";

interface EventRequestListProps {
  eventRequests: EventRequest[];
  isLoading: boolean;
}

export const EventRequestList = ({ eventRequests, isLoading }: EventRequestListProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return format(dateObj, 'PPP', { locale: language === 'es' ? es : undefined });
  };

  const formatTime = (date: string) => {
    const dateObj = new Date(date);
    return format(dateObj, 'p');
  };

  const handleApprove = async (requestId: string) => {
    try {
      // Get request data
      const { data: requestData, error: fetchError } = await supabase
        .from('event_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Create calendar event
      const { error: insertError } = await supabase
        .from('events')
        .insert({
          ...requestData,
          user_id: requestData.business_id,
          id: undefined,
          status: undefined,
          business_id: undefined,
        });

      if (insertError) throw insertError;

      // Update request status
      const { error: updateError } = await supabase
        .from('event_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      toast({
        title: t("eventRequests.approved"),
        description: "The booking has been added to your calendar.",
      });

      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['eventRequests'] });
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: error.message || "Could not approve request",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('event_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: t("eventRequests.rejected"),
        description: "The booking request has been rejected.",
      });

      queryClient.invalidateQueries({ queryKey: ['eventRequests'] });
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: error.message || "Could not reject request",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="py-10 text-center">Loading booking requests...</div>;
  }

  if (eventRequests.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        {t("eventRequests.noPending")}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {eventRequests.map((request) => (
        <Card key={request.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg font-medium">
                {request.title} {request.user_surname}
              </CardTitle>
              <Badge variant={request.status === 'pending' ? 'outline' : request.status === 'approved' ? 'success' : 'destructive'}>
                {request.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDate(request.start_date)} • {formatTime(request.start_date)} - {formatTime(request.end_date)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {request.user_number && (
                <div>
                  <span className="font-medium">Phone:</span> {request.user_number}
                </div>
              )}
              {request.social_network_link && (
                <div>
                  <span className="font-medium">Email/Social:</span> {request.social_network_link}
                </div>
              )}
            </div>
            
            {request.event_notes && (
              <div className="text-sm mb-4">
                <span className="font-medium">Notes:</span> {request.event_notes}
              </div>
            )}
            
            {request.status === 'pending' && (
              <div className="flex space-x-2 mt-4">
                <Button 
                  size="sm" 
                  onClick={() => handleApprove(request.id)}
                  className="flex-1"
                >
                  {t("eventRequests.approve")}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleReject(request.id)}
                  className="flex-1"
                >
                  {t("eventRequests.reject")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
