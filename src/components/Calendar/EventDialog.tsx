import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  initialData?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

// Define interface for person data (matching EventDialogFields)
interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

export const EventDialog = ({
  isOpen,
  onClose,
  selectedDate,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
}: EventDialogProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  
  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");

  // Add reminder state
  const [reminderTime, setReminderTime] = useState<Date | null>(null);

  const isEditing = !!initialData;
  const isGeorgian = language === 'ka';

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Populate form with existing data
        setTitle(initialData.title || "");
        setUserSurname(initialData.user_surname || "");
        setUserNumber(initialData.user_number || "");
        setSocialNetworkLink(initialData.social_network_link || "");
        setEventNotes(initialData.event_notes || "");
        setEventName(initialData.event_name || "");
        setStartDate(initialData.start_date || "");
        setEndDate(initialData.end_date || "");
        setPaymentStatus(initialData.payment_status || "not_paid");
        setPaymentAmount(initialData.payment_amount?.toString() || "");
        setIsRecurring(initialData.is_recurring || false);
        setRepeatPattern(initialData.repeat_pattern || "");
        setRepeatUntil(initialData.repeat_until || "");
        
        // Set reminder time from existing data
        setReminderTime(initialData.reminder_time ? new Date(initialData.reminder_time) : null);
        
        // Load existing files
        if (initialData.files) {
          setExistingFiles(initialData.files);
        }
      } else if (selectedDate) {
        // Set default start/end dates for new events
        const startDateTime = format(selectedDate, "yyyy-MM-dd'T'HH:mm");
        const endDateTime = format(new Date(selectedDate.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm");
        setStartDate(startDateTime);
        setEndDate(endDateTime);
        
        // Reset all other fields for new events
        setTitle("");
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setEventName("");
        setPaymentStatus("not_paid");
        setPaymentAmount("");
        setIsRecurring(false);
        setRepeatPattern("");
        setRepeatUntil("");
        setReminderTime(null);
        setFiles([]);
        setExistingFiles([]);
        setAdditionalPersons([]);
      }
    }
  }, [isOpen, initialData, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const eventData = {
        title: userSurname || title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
        reminder_time: reminderTime ? reminderTime.toISOString() : null,
        language: language || 'en'
      };

      if (isEditing && initialData) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', initialData.id);

        if (error) throw error;

        // Handle file uploads for updated event
        await handleFileUploads(initialData.id);

        toast({
          title: t("common.success"),
          description: t("events.eventUpdateSuccess"),
        });

        onEventUpdated?.();
      } else {
        // Create new event
        const { data, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();

        if (error) throw error;

        // Handle file uploads for new event
        await handleFileUploads(data.id);

        toast({
          title: t("common.success"),
          description: t("events.eventCreateSuccess"),
        });

        onEventCreated?.();
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("events.eventSaveError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUploads = async (eventId: string) => {
    if (files.length === 0) return;

    const uploadPromises = files.map(async (file) => {
      const fileName = `${eventId}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('event_attachments')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return;
      }

      const { error: dbError } = await supabase
        .from('event_files')
        .insert([{
          event_id: eventId,
          filename: file.name,
          file_path: fileName,
          content_type: file.type,
          size: file.size,
        }]);

      if (dbError) {
        console.error('Error saving file record:', dbError);
      }
    });

    await Promise.all(uploadPromises);
  };

  const handleDelete = async () => {
    if (!initialData || loading) return;

    if (!confirm(t("events.deleteEventConfirm"))) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', initialData.id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("events.eventDeleteSuccess"),
      });

      onEventDeleted?.();
      onClose();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("events.eventDeleteError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
            {isGeorgian ? (
              <GeorgianAuthText>
                {isEditing ? "მოვლენის რედაქტირება" : "ახალი მოვლენა"}
              </GeorgianAuthText>
            ) : (
              <LanguageText>{isEditing ? t("events.editEvent") : t("events.newEvent")}</LanguageText>
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
            eventId={initialData?.id}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={repeatUntil}
            setRepeatUntil={setRepeatUntil}
            isNewEvent={!isEditing}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            reminderTime={reminderTime}
            setReminderTime={setReminderTime}
          />

          <div className="flex justify-between">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <LanguageText>{t("common.delete")}</LanguageText>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                <LanguageText>{t("common.cancel")}</LanguageText>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <LanguageText>{t("common.loading")}</LanguageText>
                ) : (
                  <LanguageText>{isEditing ? t("common.update") : t("common.create")}</LanguageText>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
