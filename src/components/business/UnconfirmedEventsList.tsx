
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { CalendarEventType } from "@/lib/types/calendar";

interface UnconfirmedEventsListProps {
  businessId: string;
  onEventApproved: () => void;
}

export const UnconfirmedEventsList = ({ businessId, onEventApproved }: UnconfirmedEventsListProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingEventId, setApprovingEventId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUnconfirmedEvents = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'unconfirmed')
          .order('start_date', { ascending: true });

        if (error) throw error;
        setEvents(data || []);
      } catch (error: any) {
        console.error('Error fetching unconfirmed events:', error);
        toast({
          title: t("common.error"),
          description: error.message || "Failed to load unconfirmed events",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (businessId) {
      fetchUnconfirmedEvents();
    }
  }, [businessId, toast, t]);

  const approveEvent = async (eventId: string) => {
    try {
      setApprovingEventId(eventId);
      
      const { error } = await supabase
        .from('events')
        .update({ status: 'confirmed' })
        .eq('id', eventId)
        .eq('business_id', businessId);

      if (error) throw error;
      
      // Remove the approved event from the list
      setEvents(events.filter(event => event.id !== eventId));
      
      toast({
        title: t("common.success"),
        description: "Event approved successfully",
      });
      
      // Notify parent component
      onEventApproved();
    } catch (error: any) {
      console.error('Error approving event:', error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to approve event",
        variant: "destructive",
      });
    } finally {
      setApprovingEventId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'PPP', { locale: language === 'es' ? es : undefined });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'p', { locale: language === 'es' ? es : undefined });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("business.unconfirmedEvents")}</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("business.unconfirmedEvents")}</CardTitle>
          <CardDescription>
            {t("business.noUnconfirmedBookings")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          {t("business.noBookingsMessage")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("business.unconfirmedEvents")}</CardTitle>
        <CardDescription>
          {t("business.approveBookingsPrompt")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex items-start justify-between border-b pb-4">
              <div className="space-y-1">
                <div className="font-medium">{event.title}</div>
                <div className="text-sm text-muted-foreground">
                  {event.user_surname && <div><span className="font-medium">{t("business.nameLabel")}:</span> {event.user_surname}</div>}
                  {event.user_number && <div><span className="font-medium">{t("business.phoneLabel")}:</span> {event.user_number}</div>}
                  <div>
                    <span className="font-medium">{t("business.dateLabel")}:</span> {formatDate(event.start_date)}
                  </div>
                  <div>
                    <span className="font-medium">{t("business.timeLabel")}:</span> {formatTime(event.start_date)} - {formatTime(event.end_date)}
                  </div>
                  {event.event_notes && (
                    <div>
                      <span className="font-medium">{t("business.notesLabel")}:</span> {event.event_notes}
                    </div>
                  )}
                </div>
              </div>
              <Button 
                onClick={() => approveEvent(event.id)}
                disabled={approvingEventId === event.id}
                className="text-green-50 bg-green-600 hover:bg-green-700"
              >
                {approvingEventId === event.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {t("business.approve")}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
