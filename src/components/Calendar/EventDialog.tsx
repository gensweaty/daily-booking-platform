import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventDialogFields } from "./EventDialogFields";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import { associateBookingFilesWithEvent } from '@/integrations/supabase/client';

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  initialData?: CalendarEventType | null;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
  isBookingRequest?: boolean;
  businessId?: string;
}

export const EventDialog = ({ 
  open, 
  onOpenChange,
  selectedDate,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
  isBookingRequest = false,
  businessId 
}: EventDialogProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
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
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";
  const shouldShowEventNameField = additionalPersons.length > 0;
  
  // Add reminder state
  const [reminderAt, setReminderAt] = useState('');
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  
  const user = supabase.auth.getUser();

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setUserSurname(initialData.user_surname || "");
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setEventNotes(initialData.event_notes || "");
      setStartDate(initialData.start_date);
      setEndDate(initialData.end_date);
      setPaymentStatus(initialData.payment_status || "not_paid");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setIsRecurring(!!initialData.recurring_pattern || !!initialData.is_recurring);
      setRepeatPattern(initialData.recurring_pattern || initialData.repeat_pattern || "");
      setRepeatUntil(initialData.recurring_until || initialData.repeat_until || "");
      setAdditionalPersons(initialData.additional_persons || []);
      setEventName(initialData.title || "");
      
      // Populate reminder fields
      setReminderAt(initialData.reminder_at || '');
      setEmailReminderEnabled(initialData.email_reminder_enabled || false);
      
      // Load existing files
      const fetchExistingFiles = async () => {
        try {
          const { data, error } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', initialData.id);

          if (error) {
            console.error('Error fetching existing files:', error);
          } else {
            setExistingFiles(data || []);
          }
        } catch (error) {
          console.error('Error fetching existing files:', error);
        }
      };
      fetchExistingFiles();
    } else if (selectedDate) {
      // Set start and end date to selected date with default times
      const dateStr = selectedDate.toISOString().split('T')[0];
      const defaultStartTime = `${dateStr}T09:00`;
      const defaultEndTime = `${dateStr}T10:00`;
      setStartDate(defaultStartTime);
      setEndDate(defaultEndTime);
    } else {
      // Reset form for new event
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setStartDate("");
      setEndDate("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setFiles([]);
      setExistingFiles([]);
      setIsRecurring(false);
      setRepeatPattern("");
      setRepeatUntil("");
      setAdditionalPersons([]);
      setEventName("");
      
      // Reset reminder fields
      setReminderAt('');
      setEmailReminderEnabled(false);
    }
  }, [initialData, selectedDate, open]);

  const handleSave = async () => {
    if (!userSurname.trim()) {
      toast.error(t("events.fullNameRequired"));
      return;
    }

    if (!startDate || !endDate) {
      toast.error(t("events.dateTimeRequired"));
      return;
    }

    // Validate reminder time
    if (emailReminderEnabled && (!reminderAt || new Date(reminderAt) >= new Date(startDate))) {
      toast.error(isGeorgian ? "შეხსენების დრო უნდა იყოს მოვლენის დაწყებამდე" : "Reminder time must be before event start time");
      return;
    }

    setLoading(true);
    
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        throw new Error("User not authenticated");
      }

      console.log("[EventDialog] Saving event with reminder data:", {
        reminderAt,
        emailReminderEnabled,
        startDate,
        endDate
      });

      // Use the save_event_with_persons RPC function
      const { data: savedEventId, error: saveError } = await supabase.rpc('save_event_with_persons', {
        p_event_id: initialData?.id || null,
        p_user_id: currentUser.data.user.id,
        p_title: shouldShowEventNameField ? eventName.trim() || userSurname.trim() : userSurname.trim(),
        p_user_surname: userSurname.trim(),
        p_user_number: userNumber.trim(),
        p_social_network_link: socialNetworkLink.trim(),
        p_event_notes: eventNotes.trim(),
        p_start_date: startDate,
        p_end_date: endDate,
        p_payment_status: paymentStatus,
        p_payment_amount: showPaymentAmount ? parseFloat(paymentAmount) || null : null,
        p_language: language,
        p_additional_persons: additionalPersons,
        p_recurring_pattern: isRecurring && repeatPattern && repeatPattern !== 'none' ? repeatPattern : null,
        p_recurring_until: isRecurring && repeatUntil ? repeatUntil : null,
        p_reminder_at: emailReminderEnabled ? reminderAt : null,
        p_email_reminder_enabled: emailReminderEnabled
      });

      if (saveError) {
        console.error("[EventDialog] Error saving event:", saveError);
        throw saveError;
      }

      console.log("[EventDialog] Event saved successfully with ID:", savedEventId);

      // Handle file uploads if needed
      if (files.length > 0) {
        console.log("[EventDialog] Uploading files...");
        // File upload logic would go here if needed
      }

      // If this is a new event and we have a valid email, potentially send booking approval email
      if (!initialData && socialNetworkLink.trim() && socialNetworkLink.includes('@')) {
        console.log("[EventDialog] Triggering booking approval email...");
        
        try {
          const { error: emailError } = await supabase.functions.invoke('send-booking-approval-email', {
            body: { 
              eventId: savedEventId,
              recipientEmail: socialNetworkLink.trim(),
              language: language 
            }
          });

          if (emailError) {
            console.error("[EventDialog] Error sending booking approval email:", emailError);
          } else {
            console.log("[EventDialog] Booking approval email sent successfully");
          }
        } catch (emailError) {
          console.error("[EventDialog] Error invoking email function:", emailError);
        }
      }

      onOpenChange(false);
      
      // Call the appropriate callback
      if (initialData) {
        console.log("[EventDialog] Calling onEventUpdated");
        if (onEventUpdated) await onEventUpdated();
      } else {
        console.log("[EventDialog] Calling onEventCreated");
        if (onEventCreated) await onEventCreated();
      }

      toast.success(initialData ? t("events.eventUpdated") : t("events.eventCreated"));

    } catch (error) {
      console.error('[EventDialog] Error saving event:', error);
      toast.error(t("events.saveError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (!initialData?.id) return;

    if (initialData.recurring_parent_id && !deleteChoice) {
      setShowRecurringDeleteDialog(true);
      return;
    }

    setLoading(true);
    try {
      if (onEventDeleted) {
        await onEventDeleted();
        onOpenChange(false);
        toast.success(t("events.eventDeleted"));
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error(t("events.deleteError"));
    } finally {
      setLoading(false);
      setShowRecurringDeleteDialog(false);
    }
  };

  const closeDeleteDialog = () => {
    setShowRecurringDeleteDialog(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isBookingRequest ? (
                isGeorgian ? <GeorgianAuthText>ჯავშნის მოთხოვნის დეტალები</GeorgianAuthText> : <LanguageText>{t("booking.bookingDetails")}</LanguageText>
              ) : (
                initialData ? 
                  (isGeorgian ? <GeorgianAuthText>მოვლენის რედაქტირება</GeorgianAuthText> : <LanguageText>{t("events.editEvent")}</LanguageText>) :
                  (isGeorgian ? <GeorgianAuthText>ახალი მოვლენა</GeorgianAuthText> : <LanguageText>{t("events.newEvent")}</LanguageText>)
              )}
            </DialogTitle>
          </DialogHeader>

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
            isBookingRequest={isBookingRequest}
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

          <div className="flex justify-between pt-4">
            {initialData && !isBookingRequest && (
              <Button variant="destructive" onClick={() => handleDelete()} disabled={loading}>
                {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
              </Button>
            )}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                {isGeorgian ? <GeorgianAuthText>გაუქმება</GeorgianAuthText> : <LanguageText>{t("common.cancel")}</LanguageText>}
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "..." : (initialData ? 
                  (isGeorgian ? <GeorgianAuthText>განახლება</GeorgianAuthText> : <LanguageText>{t("common.update")}</LanguageText>) : 
                  (isGeorgian ? <GeorgianAuthText>შენახვა</GeorgianAuthText> : <LanguageText>{t("common.save")}</LanguageText>)
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={showRecurringDeleteDialog}
        onOpenChange={closeDeleteDialog}
        onDeleteThis={() => handleDelete("this")}
        onDeleteSeries={() => handleDelete("series")}
        isRecurringEvent={!!initialData?.recurring_parent_id}
      />
    </>
  );
};
