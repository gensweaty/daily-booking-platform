import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { EventDialogFields } from './EventDialogFields';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/lib/types/calendar';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import { cn } from '@/lib/utils';

interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface EventDialogProps {
  event?: CalendarEventType;
  date?: Date;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export const EventDialog: React.FC<EventDialogProps> = ({
  event,
  date,
  isOpen,
  onClose,
  onSave
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  // Form state
  const [title, setTitle] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [userNumber, setUserNumber] = useState('');
  const [socialNetworkLink, setSocialNetworkLink] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
  
  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState('');
  const [repeatUntil, setRepeatUntil] = useState('');
  
  // Additional persons state
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  
  // Add email reminder state
  const [reminderAt, setReminderAt] = useState('');
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setUserSurname(event.user_surname || '');
      setUserNumber(event.user_number || '');
      setSocialNetworkLink(event.social_network_link || '');
      setEventNotes(event.event_notes || '');
      setEventName(event.event_name || '');
      setStartDate(event.start_date ? event.start_date.replace('Z', '') : '');
      setEndDate(event.end_date ? event.end_date.replace('Z', '') : '');
      setPaymentStatus(event.payment_status || 'not_paid');
      setPaymentAmount(event.payment_amount?.toString() || '');
      setIsRecurring(event.is_recurring || false);
      setRepeatPattern(event.repeat_pattern || '');
      setRepeatUntil(event.repeat_until || '');
      
      // Set reminder fields
      setReminderAt(event.reminder_at ? event.reminder_at.replace('Z', '') : '');
      setEmailReminderEnabled(event.email_reminder_enabled || false);
      
      // Load existing files
      if (event.files && event.files.length > 0) {
        setExistingFiles(event.files);
      }
    } else if (date) {
      const defaultStart = new Date(date);
      defaultStart.setHours(12, 0, 0, 0);
      const defaultEnd = new Date(defaultStart);
      defaultEnd.setHours(13, 0, 0, 0);
      
      setStartDate(defaultStart.toISOString().slice(0, 16));
      setEndDate(defaultEnd.toISOString().slice(0, 16));
    }
  }, [event, date]);

  const loadAdditionalPersons = async (eventId: string) => {
    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('event_id', eventId)
        .is('deleted_at', null);

      if (error) {
        console.error('Error loading additional persons:', error);
        return;
      }

      const persons: PersonData[] = customers.map(customer => ({
        id: customer.id,
        userSurname: customer.user_surname || '',
        userNumber: customer.user_number || '',
        socialNetworkLink: customer.social_network_link || '',
        eventNotes: customer.event_notes || '',
        paymentStatus: customer.payment_status || 'not_paid',
        paymentAmount: customer.payment_amount?.toString() || ''
      }));

      setAdditionalPersons(persons);
    } catch (error) {
      console.error('Error loading additional persons:', error);
    }
  };

  useEffect(() => {
    if (event?.id) {
      loadAdditionalPersons(event.id);
    } else {
      setAdditionalPersons([]);
    }
  }, [event?.id]);

  const validateForm = () => {
    if (!title.trim()) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "სათაური აუცილებელია" : "Title is required",
        variant: "destructive"
      });
      return false;
    }

    if (!startDate || !endDate) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error", 
        description: isGeorgian ? "დაწყებისა და დასრულების თარიღები აუცილებელია" : "Start and end dates are required",
        variant: "destructive"
      });
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "დასრულების თარიღი უნდა იყოს დაწყებისაზე მოგვიანებით" : "End date must be after start date",
        variant: "destructive"
      });
      return false;
    }

    // Validate email reminder time
    if (emailReminderEnabled && reminderAt) {
      const reminder = new Date(reminderAt);
      if (reminder >= start) {
        toast({
          title: isGeorgian ? "შეცდომა" : "Error",
          description: isGeorgian ? "შეხსენების დრო უნდა იყოს ღონისძიებამდე" : "Reminder time must be before event start time",
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) return;
    
    setIsSubmitting(true);

    try {
      const eventData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: paymentAmount || null,
        type: 'event',
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
        reminder_at: emailReminderEnabled && reminderAt ? reminderAt : null,
        email_reminder_enabled: emailReminderEnabled && reminderAt ? true : false
      };

      const additionalPersonsData = additionalPersons.map(person => ({
        userSurname: person.userSurname,
        userNumber: person.userNumber,
        socialNetworkLink: person.socialNetworkLink,
        eventNotes: person.eventNotes,
        paymentStatus: person.paymentStatus,
        paymentAmount: person.paymentAmount || null
      }));

      // Call the database function to save event with persons
      const { data: savedEventId, error: saveError } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: eventData,
          p_additional_persons: additionalPersonsData,
          p_user_id: user.id,
          p_event_id: event?.id || null
        });

      if (saveError) {
        throw saveError;
      }

      // Handle file uploads for new events
      if (files.length > 0 && savedEventId) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const filePath = `${crypto.randomUUID()}.${fileExt}`;
          
          // Upload file to storage
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, file);

          if (uploadError) {
            console.error('File upload error:', uploadError);
            continue;
          }

          // Save file record to database
          const { error: fileRecordError } = await supabase
            .from('event_files')
            .insert({
              event_id: savedEventId,
              filename: file.name,
              file_path: filePath,
              content_type: file.type,
              size: file.size,
              user_id: user.id
            });

          if (fileRecordError) {
            console.error('File record error:', fileRecordError);
          }
        }
      }

      toast({
        title: isGeorgian ? "წარმატება" : "Success",
        description: isGeorgian ? 
          (event ? "ღონისძიება წარმატებით განახლდა" : "ღონისძიება წარმატებით შეიქმნა") :
          (event ? "Event updated successfully" : "Event created successfully")
      });

      onSave?.();
      onClose();

    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "ღონისძიების შენახვისას მოხდა შეცდომა" : "Failed to save event",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form state
    setTitle('');
    setUserSurname('');
    setUserNumber('');
    setSocialNetworkLink('');
    setEventNotes('');
    setEventName('');
    setStartDate('');
    setEndDate('');
    setPaymentStatus('not_paid');
    setPaymentAmount('');
    setFiles([]);
    setExistingFiles([]);
    setIsRecurring(false);
    setRepeatPattern('');
    setRepeatUntil('');
    setAdditionalPersons([]);
    setReminderAt('');
    setEmailReminderEnabled(false);
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={isGeorgian ? {
            fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
            letterSpacing: '-0.2px',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale'
          } : undefined}>
            {isGeorgian ? (
              <GeorgianAuthText>
                {event ? "ღონისძიების რედაქტირება" : "ახალი ღონისძიება"}
              </GeorgianAuthText>
            ) : (
              <LanguageText>{event ? t("events.editEvent") : t("events.addEvent")}</LanguageText>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
            eventId={event?.id}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={repeatUntil}
            setRepeatUntil={setRepeatUntil}
            isNewEvent={!event}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            reminderAt={reminderAt}
            setReminderAt={setReminderAt}
            emailReminderEnabled={emailReminderEnabled}
            setEmailReminderEnabled={setEmailReminderEnabled}
          />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              {isGeorgian ? (
                <GeorgianAuthText>გაუქმება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.cancel")}</LanguageText>
              )}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isGeorgian ? (
                <GeorgianAuthText>
                  {isSubmitting ? "მუშავდება..." : (event ? "განახლება" : "შექმნა")}
                </GeorgianAuthText>
              ) : (
                <LanguageText>
                  {isSubmitting ? t("common.saving") : (event ? t("common.update") : t("common.create"))}
                </LanguageText>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
