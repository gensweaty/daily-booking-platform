
import { DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Clock, Phone, Mail, MessageSquare } from "lucide-react";

interface EventSummaryProps {
  event: CalendarEventType | null;
  onClose: () => void;
  isExternalCalendar?: boolean;
}

export function EventSummary({ event, onClose, isExternalCalendar = false }: EventSummaryProps) {
  const { t, language } = useLanguage();

  if (!event) return null;
  
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  
  const dateFormat = language === 'es' ? 'dd/MM/yyyy' : 'MMM d, yyyy';
  const timeFormat = language === 'es' ? 'HH:mm' : 'h:mm a';
  
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-xl">{event.title}</DialogTitle>
        <DialogDescription className="flex items-center gap-2 mt-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{format(startDate, dateFormat)}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="flex items-start gap-3">
          <Clock className="h-4 w-4 text-muted-foreground mt-1" />
          <div>
            <p className="font-medium">{t("events.time")}</p>
            <p className="text-muted-foreground">
              {format(startDate, timeFormat)} - {format(endDate, timeFormat)}
            </p>
          </div>
        </div>

        {event.user_number && (
          <div className="flex items-start gap-3">
            <Phone className="h-4 w-4 text-muted-foreground mt-1" />
            <div>
              <p className="font-medium">{t("events.phoneNumber")}</p>
              <p className="text-muted-foreground">{event.user_number}</p>
            </div>
          </div>
        )}

        {event.social_network_link && (
          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-1" />
            <div>
              <p className="font-medium">{t("events.socialLinkEmail")}</p>
              <p className="text-muted-foreground">{event.social_network_link}</p>
            </div>
          </div>
        )}

        {event.event_notes && (
          <div className="flex items-start gap-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground mt-1" />
            <div>
              <p className="font-medium">{t("events.eventNotes")}</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.event_notes}</p>
            </div>
          </div>
        )}

        {isExternalCalendar && (
          <div className="bg-muted p-3 rounded-md mt-4">
            <p className="text-sm text-center">
              {t("business.bookedTimeSlot")}
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
