import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { EventDialogFields } from "../Calendar/EventDialogFields";
import { RecurringDeleteDialog } from "../Calendar/RecurringDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isVirtualInstance, getParentEventId, getInstanceDate } from "@/lib/recurringEvents";
import { Clock, RefreshCcw, User, Calendar, History } from "lucide-react";
import { format, parseISO } from "date-fns";

interface PublicEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  eventId?: string;
  initialData?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
  // Public board context
  publicBoardUserId: string;
  externalUserName: string;
  // Event operations
  onSave?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onUpdate?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onDelete?: (params: { id: string; deleteChoice?: "this" | "series" }) => Promise<{ success: boolean; }>;
}

// Helper functions for date conversion (copied from EventDialog)
const localDateTimeInputToISOString = (localDateTime: string): string => {
  if (!localDateTime) return new Date().toISOString();
  
  try {
    const localDate = new Date(localDateTime);
    const isoString = localDate.toISOString();
    
    console.log('[PublicEventDialog] Local to ISO conversion:', { 
      localDateTime, 
      localDate: localDate.toString(),
      isoString,
      timezoneOffset: localDate.getTimezoneOffset()
    });
    
    return isoString;
  } catch (error) {
    console.error('[PublicEventDialog] Error converting local datetime to ISO:', error, 'Input:', localDateTime);
    return new Date().toISOString();
  }
};

const isoToLocalDateTimeInput = (isoString: string): string => {
  if (!isoString || isoString === 'null' || isoString === '') return '';
  
  try {
    const date = new Date(isoString);
    
    if (isNaN(date.getTime())) {
      console.warn('[PublicEventDialog] Invalid date provided:', isoString);
      return '';
    }
    
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISO = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    
    console.log('[PublicEventDialog] Date conversion:', { 
      isoString, 
      utcDate: date.toISOString(), 
      localISO,
      timezoneOffset: date.getTimezoneOffset() 
    });
    return localISO;
  } catch (error) {
    console.error('[PublicEventDialog] Error converting ISO date to input format:', error, 'Input:', isoString);
    return '';
  }
};

export const PublicEventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  eventId,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
  publicBoardUserId,
  externalUserName,
  onSave,
  onUpdate,
  onDelete
}: PublicEventDialogProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  
  // Form state
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventName, setEventName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [additionalPersons, setAdditionalPersons] = useState<Array<{
    id: string;
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>>([]);
  const [currentEventData, setCurrentEventData] = useState<CalendarEventType | null>(null);
  const [reminderAt, setReminderAt] = useState("");
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string>("");
  const [editorDisplayName, setEditorDisplayName] = useState<string>("");

  const isNewEvent = !initialData && !eventId;
  const isVirtualEvent = eventId ? isVirtualInstance(eventId) : false;
  const isRecurringEvent = initialData?.is_recurring || isVirtualEvent || isRecurring;
  
  // Check if current user is the creator of this event
  const isEventCreatedByCurrentUser = initialData ? 
    (initialData.created_by_type === 'sub_user' && initialData.created_by_name === externalUserName) ||
    (initialData.created_by_type !== 'sub_user' && initialData.created_by_type !== 'admin') : true;

  // Helper function to normalize names (similar to tasks)
  const normalizeName = (name?: string, type?: string) => {
    if (!name) return undefined;
    if (type === 'admin') {
      // For admin users, return the fetched display name or fallback
      return creatorDisplayName || editorDisplayName || (name.includes('@') ? name.split('@')[0] : name);
    }
    return name;
  };

  // Fetch display names for admin users
  useEffect(() => {
    const fetchDisplayNames = async () => {
      const eventData = currentEventData || initialData;
      if (!eventData) return;

      // Fetch creator display name if admin
      if (eventData.created_by_type === 'admin' && eventData.created_by_name) {
        try {
          // Try to find profile by user ID first (if name is actually a user ID)
          const { data: profileById } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', eventData.created_by_name)
            .single();
          
          if (profileById?.username) {
            setCreatorDisplayName(profileById.username);
          } else {
            // If not found by ID and it's an email, get username from email prefix
            setCreatorDisplayName(eventData.created_by_name.includes('@') ? eventData.created_by_name.split('@')[0] : eventData.created_by_name);
          }
        } catch (error) {
          console.error('Error fetching creator profile:', error);
          setCreatorDisplayName(eventData.created_by_name.includes('@') ? eventData.created_by_name.split('@')[0] : eventData.created_by_name);
        }
      } else {
        setCreatorDisplayName(eventData.created_by_name || '');
      }

      // Fetch editor display name if admin
      if (eventData.last_edited_by_type === 'admin' && eventData.last_edited_by_name) {
        try {
          // Try to find profile by user ID first
          const { data: profileById } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', eventData.last_edited_by_name)
            .single();
          
          if (profileById?.username) {
            setEditorDisplayName(profileById.username);
          } else {
            // If not found by ID and it's an email, get username from email prefix
            setEditorDisplayName(eventData.last_edited_by_name.includes('@') ? eventData.last_edited_by_name.split('@')[0] : eventData.last_edited_by_name);
          }
        } catch (error) {
          console.error('Error fetching editor profile:', error);
          setEditorDisplayName(eventData.last_edited_by_name.includes('@') ? eventData.last_edited_by_name.split('@')[0] : eventData.last_edited_by_name);
        }
      } else {
        setEditorDisplayName(eventData.last_edited_by_name || '');
      }
    };

    fetchDisplayNames();
  }, [currentEventData, initialData]);

  // Initialize form data
  useEffect(() => {
    const loadAndSetEventData = async () => {
      if (open) {
        if (initialData || eventId) {
          const eventData = initialData;
          
          if (eventData) {
            console.log('[PublicEventDialog] Loading event data for editing:', eventData);
            
            setTitle(eventData.title || "");
            setUserSurname(eventData.user_surname || "");
            setUserNumber(eventData.user_number || "");
            setSocialNetworkLink(eventData.social_network_link || "");
            setEventNotes(eventData.event_notes || "");
            setEventName(eventData.event_name || "");
            setPaymentStatus(eventData.payment_status || "");
            setPaymentAmount(eventData.payment_amount?.toString() || "");

            setStartDate(isoToLocalDateTimeInput(eventData.start_date));
            setEndDate(isoToLocalDateTimeInput(eventData.end_date));

            setIsRecurring(eventData.is_recurring || false);
            setRepeatPattern(eventData.repeat_pattern || "");
            setRepeatUntil(eventData.repeat_until || "");
            
            const reminderValue = eventData.reminder_at;
            if (reminderValue && reminderValue !== null && reminderValue !== 'null') {
              const convertedReminder = isoToLocalDateTimeInput(reminderValue);
              setReminderAt(convertedReminder);
            } else {
              setReminderAt("");
            }
            
            setEmailReminderEnabled(Boolean(eventData.email_reminder_enabled));
          }
        } else if (selectedDate) {
          const startDateTime = isoToLocalDateTimeInput(selectedDate.toISOString());
          const endDateTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);
          setStartDate(startDateTime);
          setEndDate(isoToLocalDateTimeInput(endDateTime.toISOString()));

          // Reset all fields for new event
          resetFormFields();
        }
      }
    };

    loadAndSetEventData();
  }, [open, selectedDate, initialData, eventId, isVirtualEvent]);

  const resetFormFields = () => {
    setAdditionalPersons([]);
    setTitle("");
    setUserSurname("");
    setUserNumber("");
    setSocialNetworkLink("");
    setEventNotes("");
    setEventName("");
    setPaymentStatus("");
    setPaymentAmount("");
    setIsRecurring(false);
    setRepeatPattern("");
    setRepeatUntil("");
    setFiles([]);
    setExistingFiles([]);
    setCurrentEventData(null);
    setReminderAt("");
    setEmailReminderEnabled(false);
    setCreatorDisplayName("");
    setEditorDisplayName("");
    console.log('[PublicEventDialog] Form fields reset');
  };

  const resetForm = () => {
    resetFormFields();
    setStartDate("");
    setEndDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: "Start date and end date are required",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const eventData = {
        title: userSurname || title || 'Untitled Event',
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: localDateTimeInputToISOString(startDate),
        end_date: localDateTimeInputToISOString(endDate),
        payment_status: paymentStatus || 'not_paid',
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        type: 'event' as const,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring ? repeatPattern : undefined,
        repeat_until: isRecurring ? repeatUntil : undefined,
        reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : undefined,
        email_reminder_enabled: emailReminderEnabled,
        language: language || 'en',
        user_id: publicBoardUserId
      };

      console.log('[PublicEventDialog] Submitting event data:', eventData);

      if (eventId || initialData) {
        // Update existing event
        if (!onUpdate) throw new Error("Update function not provided");
        
        const updatedEvent = await onUpdate({
          ...eventData,
          id: eventId || initialData?.id
        });
        
        console.log('[PublicEventDialog] Event updated successfully:', updatedEvent);
        
        toast({
          title: t("common.success"),
          description: t("events.eventUpdated")
        });

        onEventUpdated?.();
      } else {
        // Create new event
        if (!onSave) throw new Error("Save function not provided");
        
        const createdEvent = await onSave(eventData);
        
        console.log('[PublicEventDialog] Event created successfully:', createdEvent);

        if (isRecurring) {
          toast({
            title: t("common.success"),
            description: t("events.recurringEventCreated")
          });
        } else {
          toast({
            title: t("common.success"),
            description: t("events.eventCreated")
          });
        }

        onEventCreated?.();
      }

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error('[PublicEventDialog] Error saving event:', error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to save event",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteThis = async () => {
    if (!eventId && !initialData?.id) return;
    if (!onDelete) throw new Error("Delete function not provided");
    
    setIsLoading(true);
    try {
      await onDelete({ 
        id: eventId || initialData!.id, 
        deleteChoice: 'this' 
      });

      toast({
        title: t("common.success"),
        description: t("events.eventDeleted")
      });

      onEventDeleted?.();
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('[PublicEventDialog] Error deleting event:', error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete event",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSeries = async () => {
    if (!eventId && !initialData?.id) return;
    if (!onDelete) throw new Error("Delete function not provided");
    
    setIsLoading(true);
    try {
      const targetEventId = eventId || initialData!.id;
      const parentId = isVirtualEvent && eventId ? getParentEventId(eventId) : targetEventId;

      await onDelete({ 
        id: parentId, 
        deleteChoice: 'series' 
      });

      toast({
        title: t("common.success"),
        description: t("events.seriesDeleted")
      });

      onEventDeleted?.();
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('[PublicEventDialog] Error deleting event series:', error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete event series",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {eventId || initialData ? t("events.editEvent") : language === 'ka' ? "მოვლენის დამატება" : t("events.addEvent")}
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
              paymentStatus={paymentStatus}
              setPaymentStatus={(value: string) => setPaymentStatus(value as any)}
              paymentAmount={paymentAmount}
              setPaymentAmount={setPaymentAmount}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              repeatPattern={repeatPattern}
              setRepeatPattern={setRepeatPattern}
              repeatUntil={repeatUntil}
              setRepeatUntil={setRepeatUntil}
              files={files}
              setFiles={setFiles}
              existingFiles={existingFiles}
              setExistingFiles={setExistingFiles}
              additionalPersons={additionalPersons}
              setAdditionalPersons={setAdditionalPersons}
              isVirtualEvent={isVirtualEvent}
              isNewEvent={isNewEvent}
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
              emailReminderEnabled={emailReminderEnabled}
              setEmailReminderEnabled={setEmailReminderEnabled}
            />
            
            {(initialData || currentEventData) && (
              <div className="px-2 py-1 sm:px-3 sm:py-2 rounded-md border border-border bg-card text-card-foreground w-fit mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="truncate">
                      {t("common.created")} {format(parseISO((currentEventData || initialData)?.created_at || ''), 'MM/dd/yy HH:mm')}
                      {(currentEventData || initialData)?.created_by_name && (
                        <span className="ml-1">
                          {language === 'ka' 
                            ? `${normalizeName((currentEventData || initialData)?.created_by_name, (currentEventData || initialData)?.created_by_type) || creatorDisplayName}-ს ${t("common.by")}` 
                            : `${t("common.by")} ${normalizeName((currentEventData || initialData)?.created_by_name, (currentEventData || initialData)?.created_by_type) || creatorDisplayName}`}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <History className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="truncate">
                      {t("common.lastUpdated")} {format(parseISO((currentEventData || initialData)?.updated_at || (currentEventData || initialData)?.created_at || ''), 'MM/dd/yy HH:mm')}
                      {(currentEventData || initialData)?.last_edited_by_name && (currentEventData || initialData)?.updated_at && (
                        <span className="ml-1">
                          {language === 'ka' 
                            ? `${normalizeName((currentEventData || initialData)?.last_edited_by_name, (currentEventData || initialData)?.last_edited_by_type) || editorDisplayName}-ს ${t("common.by")}` 
                            : `${t("common.by")} ${normalizeName((currentEventData || initialData)?.last_edited_by_name, (currentEventData || initialData)?.last_edited_by_type) || editorDisplayName}`}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              {isEventCreatedByCurrentUser && (
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? t("common.loading") : eventId || initialData ? t("common.update") : t("common.add")}
                </Button>
              )}
              
              {(eventId || initialData) && isEventCreatedByCurrentUser && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)} 
                  disabled={isLoading} 
                  className="flex-1 sm:flex-none"
                >
                  {t("common.delete")}
                </Button>
              )}
              
              {!isEventCreatedByCurrentUser && (eventId || initialData) && (
                <div className="text-sm text-muted-foreground text-center p-2 bg-muted/50 rounded">
                  {language === 'ka' ? 'მხოლოდ ღონისძიების შემქმნელს შეუძლია მისი რედაქტირება ან წაშლა' : 'Only the event creator can edit or delete this event'}
                </div>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog 
        open={showDeleteDialog} 
        onOpenChange={setShowDeleteDialog} 
        onDeleteThis={handleDeleteThis} 
        onDeleteSeries={handleDeleteSeries} 
        isRecurringEvent={isRecurringEvent} 
        isLoading={isLoading} 
      />
    </>
  );
};