import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { cn } from "@/lib/utils";
import { CalendarEventType } from "@/lib/types/calendar";
import { FileRecord } from "@/types/files";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { EventDialogFields } from "./EventDialogFields";
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from "@/contexts/AuthContext";
import { Calendar as CalendarIcon, Bell, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  initialData?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

// Function to format date to YYYY-MM-DDTHH:mm
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const EventDialog = ({ open, onOpenChange, selectedDate, initialData, onEventCreated, onEventUpdated, onEventDeleted }: EventDialogProps) => {
  const {
    t,
    language
  } = useLanguage();
  const isGeorgian = language === 'ka';
  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;
  const [title, setTitle] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [userNumber, setUserNumber] = useState('');
  const [socialNetworkLink, setSocialNetworkLink] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState(selectedDate ? formatDateForInput(selectedDate) : '');
  const [endDate, setEndDate] = useState(selectedDate ? formatDateForInput(selectedDate) : '');
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
  const [loading, setLoading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState('');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [additionalPersons, setAdditionalPersons] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  // Add reminder state variables
  const [reminderAt, setReminderAt] = useState<string>("");
  const [emailReminderEnabled, setEmailReminderEnabled] = useState<boolean>(false);

  const loadAdditionalPersons = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('event_id', eventId);

      if (error) {
        console.error('Error fetching additional persons:', error);
        return;
      }

      setAdditionalPersons(data || []);
    } catch (error) {
      console.error('Error loading additional persons:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setUserSurname('');
    setUserNumber('');
    setSocialNetworkLink('');
    setEventNotes('');
    setEventName('');
    setStartDate(selectedDate ? formatDateForInput(selectedDate) : '');
    setEndDate(selectedDate ? formatDateForInput(selectedDate) : '');
    setPaymentStatus('not_paid');
    setPaymentAmount('');
    setFiles([]);
    setExistingFiles([]);
    setIsRecurring(false);
    setRepeatPattern('');
    setRepeatUntil('');
    setAdditionalPersons([]);
    setReminderAt("");
    setEmailReminderEnabled(false);
  };

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setUserSurname(initialData.user_surname || "");
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setEventNotes(initialData.event_notes || "");
      setEventName(initialData.event_name || "");
      setStartDate(formatDateForInput(new Date(initialData.start_date)));
      setEndDate(formatDateForInput(new Date(initialData.end_date)));
      setPaymentStatus(initialData.payment_status || "not_paid");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setIsRecurring(initialData.is_recurring || false);
      setRepeatPattern(initialData.repeat_pattern || "");
      setRepeatUntil(initialData.repeat_until || "");
      
      // Set reminder fields
      setReminderAt(initialData.reminder_at ? formatDateForInput(new Date(initialData.reminder_at)) : "");
      setEmailReminderEnabled(initialData.email_reminder_enabled || false);
      
      // Load existing files
      if (initialData.files && initialData.files.length > 0) {
        setExistingFiles(initialData.files);
      }
      
      // Load additional persons (customers)
      loadAdditionalPersons(initialData.id);
    } else if (selectedDate) {
      resetForm();
      setStartDate(formatDateForInput(selectedDate));
      setEndDate(formatDateForInput(selectedDate));
      
      // Initialize reminder fields for new events
      setReminderAt("");
      setEmailReminderEnabled(false);
    }
  }, [initialData, selectedDate]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch (error) {
      console.error("Error formatting date:", error);
      return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      console.error("No authenticated user found");
      return;
    }

    setLoading(true);

    try {
      // Validate dates
      if (new Date(startDate) >= new Date(endDate)) {
        toast({
          title: t("common.error"),
          description: "End date must be after start date",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Handle file uploads
      const uploadedFilePaths: string[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const filePath = `event_attachments/${user.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error("File upload error:", uploadError);
            throw new Error("File upload failed");
          }

          uploadedFilePaths.push(filePath);
        }
      }

      const eventData = {
        title: userSurname || title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        type: 'event',
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
        language: language,
        // Add reminder fields
        reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
        email_reminder_enabled: emailReminderEnabled,
      };

      if (initialData) {
        // Update existing event
        await onEventUpdated?.();
      } else {
        // Create new event
        await onEventCreated?.();
      }

      onOpenChange(false);
      toast({
        title: t("common.success"),
        description: t("events.eventSaved"),
      });
    } catch (error: any) {
      console.error("Event save error:", error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    setLoading(true);
    try {
      if (!initialData) throw new Error("No event to delete");
      await onEventDeleted?.();
      onOpenChange(false);
      toast({
        title: t("common.success"),
        description: t("events.eventDeleted"),
      });
    } catch (error: any) {
      console.error("Event delete error:", error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl max-h-[90vh] overflow-y-auto", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            <CalendarIcon className="h-5 w-5" />
            {(reminderAt || initialData?.reminder_at) && (
              <div className="flex items-center gap-1 text-blue-600">
                <Bell className="h-4 w-4" />
                {emailReminderEnabled || initialData?.email_reminder_enabled ? (
                  <Mail className="h-3 w-3" />
                ) : null}
              </div>
            )}
            {isGeorgian ? <GeorgianAuthText>{initialData ? "მოვლენის რედაქტირება" : "ახალი მოვლენა"}</GeorgianAuthText> : 
            <LanguageText>{initialData ? t("events.editEvent") : t("events.addEvent")}</LanguageText>}
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
            eventId={initialData?.id}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={repeatUntil}
            setRepeatUntil={setRepeatUntil}
            isNewEvent={!initialData}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            reminderAt={reminderAt}
            setReminderAt={setReminderAt}
            emailReminderEnabled={emailReminderEnabled}
            setEmailReminderEnabled={setEmailReminderEnabled}
          />

          <DialogFooter className="flex gap-2">
            {initialData && (
              <Button type="button" variant="destructive" onClick={() => handleDelete("this")} disabled={loading}>
                {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  {isGeorgian ? <GeorgianAuthText>იტვირთება...</GeorgianAuthText> : <LanguageText>{t("common.loading")}</LanguageText>}
                </>
              ) : (
                <>
                  {isGeorgian ? <GeorgianAuthText>{t("common.save")}</GeorgianAuthText> : <LanguageText>{t("common.save")}</LanguageText>}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
