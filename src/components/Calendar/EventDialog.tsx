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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDateTimeForInput } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventDialogFields } from "@/components/Calendar/EventDialogFields";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import { PaymentStatus } from "@/lib/types";

interface EventDialogProps {
  event?: CalendarEvent;
  isOpen?: boolean;
  onClose?: () => void;
  onSave?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  isNewEvent?: boolean;
  // New props to match Calendar.tsx usage
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  selectedDate?: Date;
  initialData?: CalendarEvent;
  onEventCreated?: () => Promise<void>;
  onEventUpdated?: () => Promise<void>;
  onEventDeleted?: () => Promise<void>;
}

export const EventDialog = ({ 
  event, 
  isOpen = false, 
  onClose = () => {}, 
  onSave = () => {}, 
  onDelete, 
  isNewEvent = false,
  // Handle new props
  open,
  onOpenChange,
  selectedDate,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted
}: EventDialogProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGeorgian = language === 'ka';

  // Use the new props if provided, otherwise fall back to old ones
  const dialogOpen = open !== undefined ? open : isOpen;
  const handleClose = onOpenChange || onClose;
  const currentEvent = initialData || event;
  const currentSelectedDate = selectedDate;

  const [title, setTitle] = useState<string>(currentEvent?.title || currentEvent?.user_surname || "");
  const [userSurname, setUserSurname] = useState<string>(currentEvent?.user_surname || "");
  const [userNumber, setUserNumber] = useState<string>(currentEvent?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState<string>(currentEvent?.social_network_link || "");
  const [eventNotes, setEventNotes] = useState<string>(currentEvent?.event_notes || "");
  const [eventName, setEventName] = useState<string>(currentEvent?.event_name || "");
  const [startDate, setStartDate] = useState<string>(
    currentEvent?.start_date 
      ? formatDateTimeForInput(currentEvent.start_date) 
      : currentSelectedDate 
        ? formatDateTimeForInput(currentSelectedDate.toISOString())
        : ""
  );
  const [endDate, setEndDate] = useState<string>(
    currentEvent?.end_date 
      ? formatDateTimeForInput(currentEvent.end_date) 
      : currentSelectedDate 
        ? formatDateTimeForInput(new Date(currentSelectedDate.getTime() + 60*60*1000).toISOString())
        : ""
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(currentEvent?.payment_status as PaymentStatus || "not_paid");
  const [paymentAmount, setPaymentAmount] = useState<string>(currentEvent?.payment_amount?.toString() || "");
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [isBookingRequest, setIsBookingRequest] = useState<boolean>(currentEvent?.type === "booking_request" || false);
  const [isRecurring, setIsRecurring] = useState<boolean>(currentEvent?.is_recurring || false);
  const [repeatPattern, setRepeatPattern] = useState<string>(currentEvent?.repeat_pattern || "");
  const [repeatUntil, setRepeatUntil] = useState<string>(currentEvent?.repeat_until || "");
  const [additionalPersons, setAdditionalPersons] = useState<any[]>([]);
  const [reminderAt, setReminderAt] = useState<string>(currentEvent?.reminder_at || "");
  const [emailReminderEnabled, setEmailReminderEnabled] = useState<boolean>(currentEvent?.email_reminder_enabled || false);

  const [loading, setLoading] = useState(false);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  const loadAdditionalPersons = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user?.id);

      if (error) {
        console.error("Error loading additional persons:", error);
        toast({
          title: t("common.error"),
          description: t("events.errorLoadingPersons"),
          variant: "destructive",
        });
        return;
      }

      const formattedPersons = data.map(person => ({
        id: person.id,
        userSurname: person.user_surname || '',
        userNumber: person.user_number || '',
        socialNetworkLink: person.social_network_link || '',
        eventNotes: person.event_notes || '',
        paymentStatus: person.payment_status || 'not_paid',
        paymentAmount: person.payment_amount?.toString() || ''
      }));

      setAdditionalPersons(formattedPersons);
      console.log('👥 Loaded additional persons:', formattedPersons.length);
    } catch (error) {
      console.error("Error loading additional persons:", error);
      toast({
        title: t("common.error"),
        description: t("events.errorLoadingPersons"),
        variant: "destructive",
      });
    }
  };

  const loadExistingFiles = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', eventId);

      if (error) {
        console.error("Error loading existing files:", error);
        toast({
          title: t("common.error"),
          description: t("events.errorLoadingFiles"),
          variant: "destructive",
        });
        return;
      }

      setExistingFiles(data || []);
      console.log('📎 Loaded existing files:', data?.length || 0);
    } catch (error) {
      console.error("Error loading existing files:", error);
      toast({
        title: t("common.error"),
        description: t("events.errorLoadingFiles"),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const eventToUse = currentEvent;
    if (eventToUse) {
      setTitle(eventToUse.title || eventToUse.user_surname || "");
      setUserSurname(eventToUse.user_surname || "");
      setUserNumber(eventToUse.user_number || "");
      setSocialNetworkLink(eventToUse.social_network_link || "");
      setEventNotes(eventToUse.event_notes || "");
      setEventName(eventToUse.event_name || "");
      setStartDate(eventToUse.start_date ? formatDateTimeForInput(eventToUse.start_date) : "");
      setEndDate(eventToUse.end_date ? formatDateTimeForInput(eventToUse.end_date) : "");
      setPaymentStatus(eventToUse.payment_status as PaymentStatus || "not_paid");
      setPaymentAmount(eventToUse.payment_amount?.toString() || "");
      setIsRecurring(eventToUse.is_recurring || false);
      setRepeatPattern(eventToUse.repeat_pattern || "");
      setRepeatUntil(eventToUse.repeat_until || "");
      setReminderAt(eventToUse.reminder_at || "");
      setEmailReminderEnabled(eventToUse.email_reminder_enabled || false);
      
      if (eventToUse.id && !isNewEvent) {
        loadAdditionalPersons(eventToUse.id);
      } else {
        setAdditionalPersons([]);
      }
      
      if (eventToUse.id && !isNewEvent) {
        loadExistingFiles(eventToUse.id);
      } else {
        setExistingFiles([]);
      }
    } else if (currentSelectedDate) {
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setStartDate(formatDateTimeForInput(currentSelectedDate.toISOString()));
      setEndDate(formatDateTimeForInput(new Date(currentSelectedDate.getTime() + 60*60*1000).toISOString()));
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setFiles([]);
      setExistingFiles([]);
      setIsRecurring(false);
      setRepeatPattern("");
      setRepeatUntil("");
      setReminderAt("");
      setEmailReminderEnabled(false);
      setAdditionalPersons([]);
    }
  }, [currentEvent, isNewEvent, currentSelectedDate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles([...files, ...Array.from(e.target.files)]);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const uploadFiles = async (eventId: string) => {
    if (files.length === 0) return;

    setLoading(true);

    try {
      for (const file of files) {
        const filePath = `events/${eventId}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error("File upload error:", uploadError);
          toast({
            title: t("common.error"),
            description: t("events.fileUploadError"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { error: dbError } = await supabase
          .from('event_files')
          .insert({
            event_id: eventId,
            filename: file.name,
            file_path: filePath,
            content_type: file.type,
            size: file.size,
          });

        if (dbError) {
          console.error("Database insert error:", dbError);
          toast({
            title: t("common.error"),
            description: t("events.fileMetadataError"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      toast({
        title: t("common.success"),
        description: t("events.filesUploaded"),
      });
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: t("common.error"),
        description: t("events.fileUploadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ['eventReminders', user?.id] });
    }
  };

  const handleSave = async () => {
    if (!startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: t("events.dateRequired"),
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const eventData: Partial<CalendarEvent> = {
        title: title || userSurname,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName || undefined,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        language: language,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: (isRecurring && repeatUntil) ? repeatUntil : null,
        reminder_at: reminderAt || null,
        email_reminder_enabled: emailReminderEnabled,
        reminder_sent_at: null
      };

      if (isNewEvent && user?.id) {
        eventData.user_id = user.id;
      }

      let upsertedEvent;
      if (currentEvent?.id) {
        const { data, error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', currentEvent.id)
          .select()
          .single();

        if (error) {
          console.error("Event update error:", error);
          toast({
            title: t("common.error"),
            description: t("events.eventUpdateError"),
            variant: "destructive",
          });
          return;
        }
        upsertedEvent = data;
      } else {
        const { data, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();

        if (error) {
          console.error("Event creation error:", error);
          toast({
            title: t("common.error"),
            description: t("events.eventCreationError"),
            variant: "destructive",
          });
          return;
        }
        upsertedEvent = data;
      }

      if (!upsertedEvent) {
        console.error("Event upsert failed, no data returned");
        toast({
          title: t("common.error"),
          description: t("events.eventSaveError"),
          variant: "destructive",
        });
        return;
      }

      for (const person of additionalPersons) {
        const customerData = {
          user_id: user?.id,
          event_id: upsertedEvent.id,
          user_surname: person.userSurname,
          user_number: person.userNumber,
          social_network_link: person.socialNetworkLink,
          event_notes: person.eventNotes,
          payment_status: person.paymentStatus,
          payment_amount: person.paymentAmount ? parseFloat(person.paymentAmount) : undefined
        };

        const { data: existingCustomer, error: selectError } = await supabase
          .from('customers')
          .select('*')
          .eq('event_id', upsertedEvent.id)
          .eq('social_network_link', person.socialNetworkLink)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          console.error("Error checking existing customer:", selectError);
          toast({
            title: t("common.error"),
            description: t("events.errorSavingPersons"),
            variant: "destructive",
          });
          return;
        }

        if (existingCustomer) {
          const { error: updateError } = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', existingCustomer.id);

          if (updateError) {
            console.error("Error updating customer:", updateError);
            toast({
              title: t("common.error"),
              description: t("events.errorSavingPersons"),
              variant: "destructive",
            });
            return;
          }
        } else {
          const { error: insertError } = await supabase
            .from('customers')
            .insert([customerData]);

          if (insertError) {
            console.error("Error inserting customer:", insertError);
            toast({
              title: t("common.error"),
              description: t("events.errorSavingPersons"),
              variant: "destructive",
            });
            return;
          }
        }
      }

      await uploadFiles(upsertedEvent.id);

      toast({
        title: t("common.success"),
        description: t("events.eventSaved"),
      });

      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['eventReminders', user?.id] });

      if (onEventCreated && isNewEvent) {
        await onEventCreated();
      } else if (onEventUpdated && !isNewEvent) {
        await onEventUpdated();
      }

      if (onSave) {
        onSave(upsertedEvent);
      }
      
      handleClose(false);
    } catch (error) {
      console.error("Event save error:", error);
      toast({
        title: t("common.error"),
        description: t("events.eventSaveError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentEvent?.id || (!onDelete && !onEventDeleted)) return;

    try {
      setLoading(true);
      
      if (onDelete) {
        await onDelete(currentEvent.id);
      } else if (onEventDeleted) {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', currentEvent.id);
        
        if (error) throw error;
        
        await onEventDeleted();
      }
      
      toast({
        title: t("common.success"),
        description: t("events.eventDeleted"),
      });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      handleClose(false);
    } catch (error) {
      console.error("Event delete error:", error);
      toast({
        title: t("common.error"),
        description: t("events.eventDeleteError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn("text-xl font-semibold", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isNewEvent ? (
              isGeorgian ? <GeorgianAuthText>ახალი მოვლენის დამატება</GeorgianAuthText> : <LanguageText>{t("events.addEvent")}</LanguageText>
            ) : (
              isGeorgian ? <GeorgianAuthText>მოვლენის რედაქტირება</GeorgianAuthText> : <LanguageText>{t("events.editEvent")}</LanguageText>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSave} className="space-y-6">
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
            setPaymentStatus={(value: string) => setPaymentStatus(value as PaymentStatus)}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            files={files}
            setFiles={setFiles}
            existingFiles={existingFiles}
            setExistingFiles={setExistingFiles}
            eventId={currentEvent?.id}
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
            isVirtualEvent={false}
            reminderAt={reminderAt}
            setReminderAt={setReminderAt}
            emailReminderEnabled={emailReminderEnabled}
            setEmailReminderEnabled={setEmailReminderEnabled}
          />

          <div className="flex justify-end space-x-2">
            {!isNewEvent && (onDelete || onEventDeleted) ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={loading}>
                    {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? <GeorgianAuthText>დარწმუნებული ხართ?</GeorgianAuthText> : <LanguageText>{t("common.areYouSure")}</LanguageText>}
                    </AlertDialogTitle>
                    <AlertDialogDescription className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? <GeorgianAuthText>ეს მოქმედება წაშლის თქვენს მოვლენას სამუდამოდ. გაგრძელება გსურთ?</GeorgianAuthText> : <LanguageText>{t("common.confirmDelete")}</LanguageText>}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? <GeorgianAuthText>გაუქმება</GeorgianAuthText> : <LanguageText>{t("common.cancel")}</LanguageText>}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={loading} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  {isGeorgian ? <GeorgianAuthText>იტვირთება</GeorgianAuthText> : <LanguageText>{t("common.loading")}</LanguageText>}
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </>
              ) : (
                isGeorgian ? <GeorgianAuthText>შენახვა</GeorgianAuthText> : <LanguageText>{t("common.save")}</LanguageText>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
