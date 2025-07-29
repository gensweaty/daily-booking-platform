
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { EventDialogFields } from "./EventDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, addMinutes, startOfToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { isVirtualInstance } from "@/lib/recurringEvents";
import { useEventDialog } from "./hooks/useEventDialog";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  initialData?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
}: EventDialogProps) => {
  const [title, setTitle] = useState(initialData?.title || "");
  const [userSurname, setUserSurname] = useState(initialData?.user_surname || "");
  const [userNumber, setUserNumber] = useState(initialData?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(initialData?.social_network_link || "");
  const [eventNotes, setEventNotes] = useState(initialData?.event_notes || "");
  const [eventName, setEventName] = useState(initialData?.event_name || "");
  const [startDate, setStartDate] = useState(initialData?.start_date || format(selectedDate || new Date(), "yyyy-MM-ddTHH:mm"));
  const [endDate, setEndDate] = useState(initialData?.end_date || format(addMinutes(selectedDate || new Date(), 60), "yyyy-MM-ddTHH:mm"));
  const [paymentStatus, setPaymentStatus] = useState(initialData?.payment_status || "not_paid");
  const [paymentAmount, setPaymentAmount] = useState(initialData?.payment_amount?.toString() || "");
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [isRecurring, setIsRecurring] = useState(initialData?.is_recurring || false);
  const [repeatPattern, setRepeatPattern] = useState(initialData?.repeat_pattern || '');
  const [repeatUntil, setRepeatUntil] = useState(initialData?.repeat_until || '');
  const [additionalPersons, setAdditionalPersons] = useState<any[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Get conflict validation from the event dialog hook and set selected event
  const eventDialogHook = useEventDialog({});
  
  // Set the selected event when initialData changes
  useEffect(() => {
    if (initialData) {
      eventDialogHook.setSelectedEvent(initialData);
    }
  }, [initialData]);
  
  const isGeorgian = language === 'ka';

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setUserSurname(initialData.user_surname || "");
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setEventNotes(initialData.event_notes || "");
      setEventName(initialData.event_name || "");
      setStartDate(initialData.start_date || format(selectedDate || new Date(), "yyyy-MM-ddTHH:mm"));
      setEndDate(initialData.end_date || format(addMinutes(selectedDate || new Date(), 60), "yyyy-MM-ddTHH:mm"));
      setPaymentStatus(initialData.payment_status || "not_paid");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setIsRecurring(initialData.is_recurring || false);
      setRepeatPattern(initialData.repeat_pattern || '');
      setRepeatUntil(initialData.repeat_until || '');

      // Fetch existing files
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
    } else {
      // Reset form when creating a new event
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setStartDate(format(selectedDate || new Date(), "yyyy-MM-ddTHH:mm"));
      setEndDate(format(addMinutes(selectedDate || new Date(), 60), "yyyy-MM-ddTHH:mm"));
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setFiles([]);
      setExistingFiles([]);
      setIsRecurring(false);
      setRepeatPattern('');
      setRepeatUntil('');
      setAdditionalPersons([]);
    }
  }, [initialData, selectedDate, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const parsedStartDate = parseISO(startDate);
    const parsedEndDate = parseISO(endDate);

    if (parsedStartDate >= parsedEndDate) {
      toast({
        title: t("common.error"),
        description: t("events.endDateMustBeAfterStart"),
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

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
    };

    try {
      if (initialData) {
        // Update event
        await eventDialogHook.handleUpdateEvent(eventData);
        toast.event.updated();
        onEventUpdated?.();
      } else {
        // Create event
        await eventDialogHook.handleCreateEvent(eventData);
        toast.event.created();
        onEventCreated?.();
      }

      // Upload files
      if (files.length > 0) {
        const eventId = initialData?.id || eventDialogHook.pendingEventData?.id;
        if (eventId) {
          for (const file of files) {
            const filePath = `event_attachments/${eventId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { error } = await supabase.storage
              .from('event_attachments')
              .upload(filePath, file, {
                contentType: file.type,
              });

            if (error) {
              console.error("File upload error:", error);
              toast({
                title: t("common.error"),
                description: t("events.fileUploadFailed"),
                variant: "destructive",
              });
            } else {
              // Create event_files record
              const { error: fileRecordError } = await supabase
                .from('event_files')
                .insert({
                  event_id: eventId,
                  filename: file.name,
                  file_path: filePath,
                  content_type: file.type,
                  size: file.size,
                  user_id: user?.id,
                  source: 'event'
                });

              if (fileRecordError) {
                console.error("Error creating file record:", fileRecordError);
                toast({
                  title: t("common.error"),
                  description: t("events.fileRecordCreateFailed"),
                  variant: "destructive",
                });
              }
            }
          }
        }
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Event creation/update error:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("events.eventCreationFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteThis = async () => {
    setIsLoading(true);
    try {
      if (!initialData) throw new Error("No event selected");
      await eventDialogHook.handleDeleteEvent("this");
      toast.event.deleted();
      onEventDeleted?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Event deletion error:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("events.eventDeletionFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleDeleteSeries = async () => {
    setIsLoading(true);
    try {
      if (!initialData) throw new Error("No event selected");
      await eventDialogHook.handleDeleteEvent("series");
      toast.event.seriesDeleted();
      onEventDeleted?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Event deletion error:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("events.eventDeletionFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={isGeorgian ? {
              fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
              letterSpacing: '-0.2px',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            } : undefined}>
              {initialData ? (
                isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">მოვლენის რედაქტირება</GeorgianAuthText> : <LanguageText>{t("events.editEvent")}</LanguageText>
              ) : (
                isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">ახალი მოვლენის შექმნა</GeorgianAuthText> : <LanguageText>{t("events.newEvent")}</LanguageText>
              )}
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
              conflictValidation={{
                data: eventDialogHook.conflictValidation.data,
                isLoading: eventDialogHook.conflictValidation.isLoading
              }}
              showConflictCheck={eventDialogHook.showConflictCheck}
            />
            
            <div className="flex justify-end space-x-2">
              {initialData && !isVirtualInstance(initialData) && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isLoading}
                >
                  {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">გაუქმება</GeorgianAuthText> : <LanguageText>{t("common.cancel")}</LanguageText>}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">იტვირთება...</GeorgianAuthText> : <LanguageText>{t("common.loading")}</LanguageText>
                ) : (
                  isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">{initialData ? "განახლება" : "შექმნა"}</GeorgianAuthText> : <LanguageText>{initialData ? t("common.update") : t("common.create")}</LanguageText>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      <RecurringDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleteThis={handleDeleteThis}
        onDeleteSeries={handleDeleteSeries}
        isRecurringEvent={initialData?.is_recurring || false}
        isLoading={isLoading}
      />
    </>
  );
};
