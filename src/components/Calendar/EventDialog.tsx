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
import { FileRecord } from "@/types/files";

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
  isOpen: boolean;
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
  isOpen, 
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
  const [existingFiles, setExistingFiles] = useState<FileRecord[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [additionalPersons, setAdditionalPersons] = useState<PersonData[]>([]);
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";
  const shouldShowEventNameField = additionalPersons.length > 0;
  
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

  // Helper function to convert UTC to local datetime-local format
  const convertUTCToLocal = (utcString: string): string => {
    console.log("[EventDialog] Converting UTC to local:", utcString);
    const date = new Date(utcString);
    // Create local date without timezone offset adjustment to fix the 9-10 AM bug
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    const result = localDate.toISOString().slice(0, 16);
    console.log("[EventDialog] Converted result:", result);
    return result;
  };

  // Helper function to convert local datetime-local to UTC
  const convertLocalToUTC = (localString: string): string => {
    console.log("[EventDialog] Converting local to UTC:", localString);
    const date = new Date(localString);
    const result = date.toISOString();
    console.log("[EventDialog] UTC result:", result);
    return result;
  };

  useEffect(() => {
    console.log("[EventDialog] useEffect triggered with:", { isOpen, initialData: !!initialData, selectedDate });
    
    if (initialData) {
      console.log('[EventDialog] Loading initial data:', initialData);
      
      setTitle(initialData.title || "");
      setUserSurname(initialData.user_surname || "");
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setEventNotes(initialData.event_notes || "");
      
      // Fix timezone issue - convert UTC to local time for display
      if (initialData.start_date) {
        const localStart = convertUTCToLocal(initialData.start_date);
        setStartDate(localStart);
        console.log('[EventDialog] Setting start date:', localStart, 'from UTC:', initialData.start_date);
      }
      
      if (initialData.end_date) {
        const localEnd = convertUTCToLocal(initialData.end_date);
        setEndDate(localEnd);
        console.log('[EventDialog] Setting end date:', localEnd, 'from UTC:', initialData.end_date);
      }
      
      setPaymentStatus(initialData.payment_status || "not_paid");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setIsRecurring(!!initialData.recurring_pattern || !!initialData.is_recurring);
      setRepeatPattern(initialData.recurring_pattern || initialData.repeat_pattern || "");
      setRepeatUntil(initialData.recurring_until || initialData.repeat_until || "");
      setAdditionalPersons(initialData.additional_persons || []);
      setEventName(initialData.title || "");
      
      // ✅ FIX: Debug logging and consistent field usage for reminders
      console.log('[EventDialog] Loading reminder data from initialData:', {
        reminder_at: initialData.reminder_at,
        email_reminder_enabled: initialData.email_reminder_enabled,
        reminder_enabled: initialData.reminder_enabled // This should not exist but check anyway
      });
      
      // Set reminder time - convert UTC to local for display
      if (initialData.reminder_at) {
        try {
          const localReminder = convertUTCToLocal(initialData.reminder_at);
          setReminderAt(localReminder);
          console.log('[EventDialog] ✅ Setting reminder at:', localReminder, 'from UTC:', initialData.reminder_at);
        } catch (error) {
          console.error('[EventDialog] ❌ Error converting reminder time:', error);
          setReminderAt('');
        }
      } else {
        setReminderAt('');
        console.log('[EventDialog] No reminder time found, clearing field');
      }
      
      // ✅ FIX: Only use email_reminder_enabled field consistently
      const isEmailReminderEnabled = !!initialData.email_reminder_enabled;
      setEmailReminderEnabled(isEmailReminderEnabled);
      console.log('[EventDialog] ✅ Setting email reminder enabled to:', isEmailReminderEnabled);
      
      // ✅ Additional debug: Check if we have data but it's not showing
      if (initialData.reminder_at || initialData.email_reminder_enabled) {
        console.log('[EventDialog] 🔍 REMINDER DATA FOUND - Should be visible in UI:', {
          reminderAt: initialData.reminder_at,
          emailReminderEnabled: initialData.email_reminder_enabled
        });
      }
      
      // Fetch existing files
      const fetchExistingFiles = async () => {
        try {
          const { data, error } = await supabase
            .from('event_files')
            .select('id, filename, file_path, content_type, size, created_at, user_id')
            .eq('event_id', initialData.id);

          if (error) {
            console.error('Error fetching existing files:', error);
          } else {
            const fileRecords: FileRecord[] = (data || []).map(file => ({
              id: file.id,
              filename: file.filename,
              file_path: file.file_path,
              content_type: file.content_type || null,
              size: file.size || null,
              created_at: file.created_at || new Date().toISOString(),
              user_id: file.user_id || null
            }));
            setExistingFiles(fileRecords);
          }
        } catch (error) {
          console.error('Error fetching existing files:', error);
        }
      };
      fetchExistingFiles();
    } else if (selectedDate) {
      console.log('[EventDialog] Setting up for new event with selected date:', selectedDate);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const defaultStartTime = `${dateStr}T09:00`;
      const defaultEndTime = `${dateStr}T10:00`;
      setStartDate(defaultStartTime);
      setEndDate(defaultEndTime);
      
      // Clear reminder fields for new events
      setReminderAt('');
      setEmailReminderEnabled(false);
    } else {
      console.log('[EventDialog] Clearing all fields');
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
      
      setReminderAt('');
      setEmailReminderEnabled(false);
    }
  }, [initialData, selectedDate, isOpen]);

  const fetchBusinessAddress = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('contact_address')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching business address:', error);
        return null;
      }
      
      return data?.contact_address || null;
    } catch (error) {
      console.error('Error fetching business address:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!userSurname.trim()) {
      toast.error(t("events.fullNameRequired"));
      return;
    }

    if (!startDate || !endDate) {
      toast.error(t("events.dateTimeRequired"));
      return;
    }

    // Validate reminder time if enabled
    if (emailReminderEnabled && reminderAt) {
      const reminderDate = new Date(reminderAt);
      const startDateObj = new Date(startDate);
      
      if (reminderDate >= startDateObj) {
        toast.error(isGeorgian ? "შეხსენების დრო უნდა იყოს მოვლენის დაწყებამდე" : "Reminder must be before event start time");
        return;
      }
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

      const additionalPersonsJson = additionalPersons.map(person => ({
        id: person.id,
        userSurname: person.userSurname,
        userNumber: person.userNumber,
        socialNetworkLink: person.socialNetworkLink,
        eventNotes: person.eventNotes,
        paymentStatus: person.paymentStatus,
        paymentAmount: person.paymentAmount
      }));

      // Convert local times to UTC before saving
      const startDateUTC = convertLocalToUTC(startDate);
      const endDateUTC = convertLocalToUTC(endDate);
      const reminderAtUTC = emailReminderEnabled && reminderAt ? convertLocalToUTC(reminderAt) : null;

      console.log("[EventDialog] Converting to UTC:", {
        local_start: startDate,
        utc_start: startDateUTC,
        local_reminder: reminderAt,
        utc_reminder: reminderAtUTC
      });

      // Properly include reminder fields in eventData
      const eventData = {
        title: shouldShowEventNameField ? eventName.trim() || userSurname.trim() : userSurname.trim(),
        user_surname: userSurname.trim(),
        user_number: userNumber.trim(),
        social_network_link: socialNetworkLink.trim(),
        event_notes: eventNotes.trim(),
        start_date: startDateUTC,
        end_date: endDateUTC,
        payment_status: paymentStatus,
        payment_amount: showPaymentAmount ? parseFloat(paymentAmount) || null : null,
        language: language,
        is_recurring: isRecurring && repeatPattern && repeatPattern !== 'none',
        repeat_pattern: isRecurring && repeatPattern && repeatPattern !== 'none' ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
        // Properly save reminder fields with UTC conversion
        reminder_at: reminderAtUTC,
        email_reminder_enabled: emailReminderEnabled
      };

      console.log("[EventDialog] Event data being saved:", eventData);

      const { data: savedEventId, error: saveError } = await supabase.rpc('save_event_with_persons', {
        p_event_data: eventData,
        p_additional_persons: additionalPersonsJson,
        p_user_id: currentUser.data.user.id,
        p_event_id: initialData?.id || null
      });

      if (saveError) {
        console.error("[EventDialog] Error saving event:", saveError);
        throw saveError;
      }

      console.log("[EventDialog] Event saved successfully with ID:", savedEventId);

      if (files.length > 0) {
        console.log("[EventDialog] Uploading files...");
      }

      // Send booking approval email if needed
      if (!initialData && socialNetworkLink.trim() && socialNetworkLink.includes('@')) {
        console.log("[EventDialog] Triggering booking approval email with business address...");
        
        try {
          const businessAddress = await fetchBusinessAddress(currentUser.data.user.id);
          
          const { error: emailError } = await supabase.functions.invoke('send-booking-approval-email', {
            body: { 
              eventId: savedEventId,
              recipientEmail: socialNetworkLink.trim(),
              language: language,
              fullName: userSurname.trim(),
              eventTitle: shouldShowEventNameField ? eventName.trim() || userSurname.trim() : userSurname.trim(),
              startDate: startDateUTC,
              endDate: endDateUTC,
              eventNotes: eventNotes.trim(),
              paymentStatus: paymentStatus,
              paymentAmount: showPaymentAmount ? parseFloat(paymentAmount) || null : null,
              businessAddress: businessAddress
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

  const handleExistingFilesChange = (files: { id: string; filename: string; file_path: string; content_type?: string; size?: number; }[]) => {
    const fileRecords: FileRecord[] = files.map(file => ({
      id: file.id,
      filename: file.filename,
      file_path: file.file_path,
      content_type: file.content_type || null,
      size: file.size || null,
      created_at: new Date().toISOString(),
      user_id: null
    }));
    setExistingFiles(fileRecords);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
            setExistingFiles={handleExistingFilesChange}
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
