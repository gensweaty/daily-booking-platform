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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { cn } from "@/lib/utils";
import { EventDialogFields } from "./EventDialogFields";
import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { LanguageText } from "@/components/shared/LanguageText";
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CalendarEventType) => void;
  initialData?: CalendarEventType;
  isNewEvent?: boolean;
}

export const EventDialog = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isNewEvent = false
}: EventDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [title, setTitle] = useState(initialData?.title || '');
  const [userSurname, setUserSurname] = useState(initialData?.user_surname || '');
  const [userNumber, setUserNumber] = useState(initialData?.user_number || '');
  const [socialNetworkLink, setSocialNetworkLink] = useState(initialData?.social_network_link || '');
  const [eventNotes, setEventNotes] = useState(initialData?.event_notes || '');
  const [eventName, setEventName] = useState(initialData?.event_name || '');
  const [startDate, setStartDate] = useState(initialData?.start_date || '');
  const [endDate, setEndDate] = useState(initialData?.end_date || '');
  const [paymentStatus, setPaymentStatus] = useState(initialData?.payment_status || 'not_paid');
  const [paymentAmount, setPaymentAmount] = useState(initialData?.payment_amount?.toString() || '');
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState(initialData?.files || []);
  const [eventId, setEventId] = useState(initialData?.id || uuidv4());
  const [isBookingRequest, setIsBookingRequest] = useState(initialData?.type === 'booking_request' || false);
  const [loading, setLoading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(initialData?.is_recurring || false);
  const [repeatPattern, setRepeatPattern] = useState(initialData?.repeat_pattern || '');
  const [repeatUntil, setRepeatUntil] = useState(initialData?.repeat_until || '');
  const [additionalPersons, setAdditionalPersons] = useState<any[]>([]);
  const [isVirtualEvent, setIsVirtualEvent] = useState(initialData?.checkAvailability || false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setUserSurname(initialData.user_surname || '');
      setUserNumber(initialData.user_number || '');
      setSocialNetworkLink(initialData.social_network_link || '');
      setEventNotes(initialData.event_notes || '');
      setEventName(initialData.event_name || '');
      setStartDate(initialData.start_date || '');
      setEndDate(initialData.end_date || '');
      setPaymentStatus(initialData.payment_status || 'not_paid');
      setPaymentAmount(initialData.payment_amount?.toString() || '');
      setExistingFiles(initialData.files || []);
      setEventId(initialData.id || uuidv4());
      setIsBookingRequest(initialData.type === 'booking_request' || false);
      setIsRecurring(initialData.is_recurring || false);
      setRepeatPattern(initialData.repeat_pattern || '');
      setRepeatUntil(initialData.repeat_until || '');
      setIsVirtualEvent(initialData.checkAvailability || false);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const eventData: CalendarEventType = {
      id: eventId,
      title,
      user_surname: userSurname,
      user_number: userNumber,
      social_network_link: socialNetworkLink,
      event_notes: eventNotes,
      event_name: eventName,
      start_date: startDate,
      end_date: endDate,
      type: initialData?.type || 'private_party',
      payment_status: paymentStatus,
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : 0,
      created_at: initialData?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: initialData?.user_id || '',
      is_recurring: isRecurring,
      repeat_pattern: repeatPattern,
      repeat_until: repeatUntil,
      checkAvailability: isVirtualEvent,
      files: existingFiles
    };

    try {
      onSave(eventData);
      toast({
        title: t("events.eventSaved"),
        description: t("events.eventSavedDescription"),
      });
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("events.eventSaveErrorDescription"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <LanguageText>
              {isNewEvent ? t("events.addEvent") : t("events.editEvent")}
            </LanguageText>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <EventDialogFields
            title={title}
            setTitle={setTitle}
            userSurname={userSurname}
            setUserSurname={setUserSurname}
            userNumber={userNumber}
            setUserNumber={setUserNumber}
            socialNetworkLink={socialNetworkLink}
            setSocialNetworkLink={setSocialNetworkLink}
            eventNotes={eventNotes}
            setEventNotes={setEventNotes}
            eventName={eventName}
            setEventName={setEventName}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            files={files}
            setFiles={setFiles}
            existingFiles={existingFiles}
            setExistingFiles={setExistingFiles}
            eventId={eventId}
            isBookingRequest={isBookingRequest}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={repeatUntil}
            setRepeatUntil={setRepeatUntil}
            isNewEvent={isNewEvent}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            isVirtualEvent={isVirtualEvent}
            eventData={initialData}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <LanguageText>{t("common.cancel")}</LanguageText>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <LanguageText>{t("common.saving")}</LanguageText>
              ) : (
                <LanguageText>{t("common.save")}</LanguageText>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
