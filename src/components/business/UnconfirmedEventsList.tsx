
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UnconfirmedEventsListProps {
  businessId: string;
  onEventApproved: () => void;
}

export const UnconfirmedEventsList = ({
  businessId,
  onEventApproved,
}: UnconfirmedEventsListProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingEvent, setApprovingEvent] = useState<string | null>(null);

  useEffect(() => {
    const fetchUnconfirmedEvents = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("business_id", businessId)
          .eq("status", "unconfirmed")
          .order("start_date", { ascending: true });

        if (error) throw error;
        setEvents(data || []);
      } catch (error: any) {
        console.error("Error fetching unconfirmed events:", error);
        toast({
          title: t("business.error"),
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (businessId) {
      fetchUnconfirmedEvents();
    }
  }, [businessId, toast, t]);

  const handleApprove = async (eventId: string) => {
    try {
      setApprovingEvent(eventId);
      
      const { error } = await supabase
        .from("events")
        .update({ status: "confirmed" })
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: t("business.eventApproved"),
        description: t("business.eventApprovedDescription"),
      });
      
      // Remove the approved event from the list
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      onEventApproved();
    } catch (error: any) {
      console.error("Error approving event:", error);
      toast({
        title: t("business.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setApprovingEvent(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("business.unconfirmedEvents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("business.unconfirmedEvents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            {t("business.noUnconfirmedEvents")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("business.unconfirmedEvents")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex flex-col sm:flex-row justify-between gap-4 p-4 border rounded-md bg-yellow-50"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{event.title}</h3>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                    {t("business.unconfirmed")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(event.start_date), "PPP", {
                    locale: language === "es" ? es : undefined,
                  })}
                  {" • "}
                  {format(parseISO(event.start_date), "p", {
                    locale: language === "es" ? es : undefined,
                  })}
                  {" - "}
                  {format(parseISO(event.end_date), "p", {
                    locale: language === "es" ? es : undefined,
                  })}
                </p>
                {event.user_surname && (
                  <p className="text-sm">
                    <span className="font-medium">{t("events.clientName")}:</span>{" "}
                    {event.user_surname}
                  </p>
                )}
                {event.user_number && (
                  <p className="text-sm">
                    <span className="font-medium">{t("events.contactNumber")}:</span>{" "}
                    {event.user_number}
                  </p>
                )}
                {event.event_notes && (
                  <p className="text-sm">
                    <span className="font-medium">{t("events.eventNotes")}:</span>{" "}
                    {event.event_notes}
                  </p>
                )}
              </div>
              <div className="flex sm:flex-col justify-end gap-2">
                <Button
                  onClick={() => handleApprove(event.id)}
                  disabled={approvingEvent === event.id}
                  className="flex items-center gap-2"
                >
                  {approvingEvent === event.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t("business.approve")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
