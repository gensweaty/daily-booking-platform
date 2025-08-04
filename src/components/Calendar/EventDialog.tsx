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
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventDialogFields } from "@/components/Calendar/EventDialogFields";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from 'date-fns';
import { DateRange } from "react-day-picker";
import { PersonData } from "@/lib/types";
import { clearCalendarCache } from "@/services/calendarService";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (event: CalendarEventType) => void;
  selectedEvent?: CalendarEventType | null;
  selectedDate?: Date | null;
}

export const EventDialog = ({ open, onOpenChange, onSave, selectedEvent, selectedDate }: EventDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize state variables
  const [title, setTitle] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [userNumber, setUserNumber] = useState('');
  const [socialNetworkLink, setSocialNetworkLink] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '');
  const [endDate, setEndDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '');
  const [paymentStatus, setPaymentStatus] = useState('not_paid');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState('');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);

  // Add email reminder state
  const [sendEmailReminder, setSendEmailReminder] = useState(false);
  const [emailReminderTime, setEmailReminderTime] = useState("");

  // Load event data when selectedEvent changes
  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title || '');
      setUserSurname(selectedEvent.user_surname || '');
      setUserNumber(selectedEvent.user_number || '');
      setSocialNetworkLink(selectedEvent.social_network_link || '');
      setEventNotes(selectedEvent.event_notes || '');
      setEventName(selectedEvent.event_name || '');
      setStartDate(selectedEvent.start_date ? format(new Date(selectedEvent.start_date), "yyyy-MM-dd'T'HH:mm") : '');
      setEndDate(selectedEvent.end_date ? format(new Date(selectedEvent.end_date), "yyyy-MM-dd'T'HH:mm") : '');
      setPaymentStatus(selectedEvent.payment_status || 'not_paid');
      setPaymentAmount(selectedEvent.payment_amount?.toString() || '');
      setIsRecurring(selectedEvent.is_recurring || false);
      setRepeatPattern(selectedEvent.repeat_pattern || '');
      setRepeatUntil(selectedEvent.repeat_until || '');
      setAdditionalPersons(selectedEvent.additional_persons || []);
      setSendEmailReminder(selectedEvent.send_email_reminder || false);
      setEmailReminderTime(selectedEvent.email_reminder_time || '');

      // Fetch existing files
      const fetchExistingFiles = async () => {
        try {
          const { data, error } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', selectedEvent.id);

          if (error) {
            console.error('Error fetching existing files:', error);
            return;
          }

          setExistingFiles(data || []);
        } catch (error) {
          console.error('Error fetching existing files:', error);
        }
      };

      fetchExistingFiles();
    } else {
      // Reset state when creating a new event
      setTitle('');
      setUserSurname('');
      setUserNumber('');
      setSocialNetworkLink('');
      setEventNotes('');
      setEventName('');
      setStartDate(selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '');
      setEndDate(selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '');
      setPaymentStatus('not_paid');
      setPaymentAmount('');
      setFiles([]);
      setExistingFiles([]);
      setIsRecurring(false);
      setRepeatPattern('');
      setRepeatUntil('');
      setAdditionalPersons([]);
      setSendEmailReminder(false);
      setEmailReminderTime('');
    }
  }, [selectedEvent, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate start and end dates
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates.",
        variant: "destructive",
      });
      return;
    }

    // Validate payment amount if payment status is partly_paid or fully_paid
    if ((paymentStatus === "partly_paid" || paymentStatus === "fully_paid") && !paymentAmount) {
      toast({
        title: "Error",
        description: "Please enter the payment amount.",
        variant: "destructive",
      });
      return;
    }

    // Prepare event data
    const eventData: Partial<CalendarEventType> = {
      title: title,
      user_surname: userSurname,
      user_number: userNumber,
      social_network_link: socialNetworkLink,
      event_notes: eventNotes,
      event_name: eventName,
      start_date: startDate,
      end_date: endDate,
      payment_status: paymentStatus,
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : 0,
      is_recurring: isRecurring,
      repeat_pattern: repeatPattern,
      repeat_until: repeatUntil,
      additional_persons: additionalPersons,
      send_email_reminder: sendEmailReminder,
      email_reminder_time: emailReminderTime
    };

    // If editing an existing event, include the ID
    if (selectedEvent) {
      eventData.id = selectedEvent.id;
    }

    // Call the onSave function to handle the actual save operation
    onSave(eventData as CalendarEventType);

    // Close the dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedEvent ? t("events.editEvent") : t("events.newEvent")}
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
            eventId={selectedEvent?.id}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={repeatUntil}
            setRepeatUntil={setRepeatUntil}
            isNewEvent={!selectedEvent}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            sendEmailReminder={sendEmailReminder}
            setSendEmailReminder={setSendEmailReminder}
            emailReminderTime={emailReminderTime}
            setEmailReminderTime={setEmailReminderTime}
          />
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
