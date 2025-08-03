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
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Partial<CalendarEventType>) => Promise<{ success: boolean }>;
  onDelete?: ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => Promise<{ success: boolean }>;
  event?: CalendarEventType | null;
  selectedDate?: string;
  isBookingRequest?: boolean;
  businessId?: string;
}

export const EventDialog = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  event, 
  selectedDate,
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
  
  const userId = supabase.auth.currentUser?.id;

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  useEffect(() => {
    if (event) {
      setTitle(event.title || "");
      setUserSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setStartDate(event.start_date);
      setEndDate(event.end_date);
      setPaymentStatus(event.payment_status || "not_paid");
      setPaymentAmount(event.payment_amount?.toString() || "");
      setIsRecurring(!!event.recurring_pattern);
      setRepeatPattern(event.recurring_pattern || "");
      setRepeatUntil(event.recurring_until || "");
      setAdditionalPersons(event.additional_persons || []);
      setEventName(event.title || "");
      
      // Populate reminder fields
      setReminderAt(event.reminder_at || '');
      setEmailReminderEnabled(event.email_reminder_enabled || false);
      
      // Load existing files
      const fetchExistingFiles = async () => {
        try {
          const { data, error } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', event.id);

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
      const defaultStartTime = `${selectedDate}T09:00`;
      const defaultEndTime = `${selectedDate}T10:00`;
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
  }, [event, selectedDate, isOpen]);

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
      const eventData: Partial<CalendarEventType> = {
        title: shouldShowEventNameField ? eventName.trim() || userSurname.trim() : userSurname.trim(),
        user_surname: userSurname.trim(),
        user_number: userNumber.trim(),
        social_network_link: socialNetworkLink.trim(),
        event_notes: eventNotes.trim(),
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: showPaymentAmount ? parseFloat(paymentAmount) || 0 : null,
        additional_persons: additionalPersons,
        // Add reminder fields
        reminder_at: emailReminderEnabled ? reminderAt : null,
        email_reminder_enabled: emailReminderEnabled,
      };

      if (isRecurring && repeatPattern && repeatPattern !== 'none') {
        eventData.recurring_pattern = repeatPattern;
        eventData.recurring_until = repeatUntil;
      } else {
        eventData.recurring_pattern = null;
        eventData.recurring_until = null;
      }

      const result = await onSave(eventData);
      
      if (result.success) {
        // Handle file uploads
        if (files.length > 0 && userId && result.eventId) {
          for (const file of files) {
            try {
              const filePath = `event_attachments/${result.eventId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
              const { error: uploadError } = await supabase.storage
                .from('event_attachments')
                .upload(filePath, file, {
                  contentType: file.type,
                });

              if (uploadError) {
                console.error('Error uploading file:', uploadError);
                toast.error(t("events.fileUploadError"));
              } else {
                // Save file metadata to the database
                const { error: dbError } = await supabase
                  .from('event_files')
                  .insert({
                    event_id: result.eventId,
                    filename: file.name,
                    file_path: filePath,
                    content_type: file.type,
                    size: file.size,
                    user_id: userId,
                    source: 'event'
                  });

                if (dbError) {
                  console.error('Error saving file metadata:', dbError);
                  toast.error(t("events.fileMetadataError"));
                }
              }
            } catch (fileError) {
              console.error('File processing error:', fileError);
              toast.error(t("events.fileProcessingError"));
            }
          }
        }
        
        // Associate booking files with event if it's a booking request
        if (isBookingRequest && businessId && result.eventId && event?.id) {
          try {
            const associatedFiles = await associateBookingFilesWithEvent(event.id, result.eventId, userId);
            if (associatedFiles && associatedFiles.length > 0) {
              console.log(`Successfully associated ${associatedFiles.length} files with event ${result.eventId}`);
            }
          } catch (error) {
            console.error('Error associating booking files with event:', error);
            toast.error(t("events.fileAssociationError"));
          }
        }
        
        onClose();
        toast.success(event ? t("events.eventUpdated") : t("events.eventCreated"));
      }
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error(t("events.saveError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (!event?.id) return;

    if (event.recurring_parent_id && !deleteChoice) {
      setShowRecurringDeleteDialog(true);
      return;
    }

    setLoading(true);
    try {
      if (onDelete) {
        const result = await onDelete({ id: event.id, deleteChoice });
        if (result.success) {
          onClose();
          toast.success(t("events.eventDeleted"));
        } else {
          toast.error(t("events.deleteError"));
        }
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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isBookingRequest ? (
                isGeorgian ? <GeorgianAuthText>ჯავშნის მოთხოვნის დეტალები</GeorgianAuthText> : <LanguageText>{t("booking.bookingDetails")}</LanguageText>
              ) : (
                event ? 
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
            eventId={event?.id}
            isBookingRequest={isBookingRequest}
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

          <div className="flex justify-between pt-4">
            {event && !isBookingRequest && (
              <Button variant="destructive" onClick={() => handleDelete()} disabled={loading}>
                {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
              </Button>
            )}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                {isGeorgian ? <GeorgianAuthText>გაუქმება</GeorgianAuthText> : <LanguageText>{t("common.cancel")}</LanguageText>}
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "..." : (event ? 
                  (isGeorgian ? <GeorgianAuthText>განახლება</GeorgianAuthText> : <LanguageText>{t("common.update")}</LanguageText>) : 
                  (isGeorgian ? <GeorgianAuthText>შენახვა</GeorgianAuthText> : <LanguageText>{t("common.save")}</LanguageText>)
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        isOpen={showRecurringDeleteDialog}
        onClose={closeDeleteDialog}
        onDelete={handleDelete}
      />
    </>
  );
};
