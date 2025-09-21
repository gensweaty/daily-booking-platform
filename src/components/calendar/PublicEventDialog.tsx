import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { EventDialogFields } from "../Calendar/EventDialogFields";
import { RecurringDeleteDialog } from "../Calendar/RecurringDeleteDialog";
import { RecurringEditDialog } from "../Calendar/RecurringEditDialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isVirtualInstance, getParentEventId, getInstanceDate } from "@/lib/recurringEvents";
import { Clock, RefreshCcw, User, Calendar, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { uploadEventFiles, loadEventFiles } from "@/utils/eventFileUpload";

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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [additionalPersons, setAdditionalPersons] = useState<any[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editChoice, setEditChoice] = useState<"this" | "series" | null>(null);
  const [currentUserProfileName, setCurrentUserProfileName] = useState("");

  // Check if this is a virtual event (recurring instance)
  const isVirtualEvent = isVirtualInstance(initialData);
  const isRecurringEvent = initialData?.is_recurring || 
    (initialData && (initialData.repeat_pattern || initialData.parent_event_id));

  console.log('[PublicEventDialog] Dialog state:', {
    open,
    eventId,
    initialData,
    isVirtualEvent,
    isRecurringEvent,
    editChoice
  });

  // Helper function to sanitize display name from email
  const sanitizeDisplayName = (name: string): string => {
    if (!name) return '';
    
    // If it's an email, extract the username part
    if (name.includes('@')) {
      return name.split('@')[0];
    }
    return name;
  };

  // Fetch current user's profile username for display
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      try {
        console.log('Fetching current user profile with publicBoardUserId:', publicBoardUserId);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', publicBoardUserId)
          .single();

        if (error) {
          console.error('Error fetching current user profile:', error);
          return;
        }

        const profileName = profile?.username || 'Unknown User';
        console.log('Current user profile name:', profileName);
        setCurrentUserProfileName(sanitizeDisplayName(profileName));
      } catch (err) {
        console.error('Exception fetching current user profile:', err);
      }
    };
    
    fetchCurrentUserProfile();
  }, [publicBoardUserId]);

  // Load additional persons for existing events
  const loadAdditionalPersons = async (targetEventId: string) => {
    try {
      console.log('[PublicEventDialog] Loading additional persons for event:', targetEventId);
      
      const { data: persons, error } = await supabase
        .from('event_additional_persons')
        .select('*')
        .eq('event_id', targetEventId);

      if (error) {
        console.error('[PublicEventDialog] Error loading additional persons:', error);
        return;
      }

      console.log('[PublicEventDialog] Loaded additional persons:', persons);
      
      const formattedPersons = (persons || []).map(person => ({
        userSurname: person.user_surname || '',
        userNumber: person.user_number || '',
        socialNetworkLink: person.social_network_link || '',
        eventNotes: person.event_notes || '',
        paymentStatus: person.payment_status || 'not_paid',
        paymentAmount: person.payment_amount ? person.payment_amount.toString() : ''
      }));

      console.log('[PublicEventDialog] Formatted additional persons:', formattedPersons);
      setAdditionalPersons(formattedPersons);
    } catch (error) {
      console.error('[PublicEventDialog] Error loading additional persons:', error);
    }
  };

  // Load existing files for event
  const loadExistingFiles = async (targetEventId: string) => {
    try {
      console.log('[PublicEventDialog] Loading existing files for event:', targetEventId);
      
      const eventFiles = await loadEventFiles({
        eventId: targetEventId,
        userId: publicBoardUserId,
        isPublicMode: true
      });

      console.log('[PublicEventDialog] Loaded existing files:', eventFiles);
      setExistingFiles(eventFiles || []);
    } catch (error) {
      console.error('[PublicEventDialog] Error loading existing files:', error);
    }
  };

  // Initialize form data
  useEffect(() => {
    const loadAndSetEventData = async () => {
      console.log('[PublicEventDialog] Setting up form for dialog opened state:', { open, initialData, eventId });
      
      if (open) {
        if (initialData) {
          console.log('[PublicEventDialog] 📝 Populating form with event data:', initialData);
          
          setTitle(initialData.title || '');
          setUserSurname(initialData.user_surname || '');
          setUserNumber(initialData.user_number || '');
          setSocialNetworkLink(initialData.social_network_link || '');
          setEventNotes(initialData.event_notes || '');
          setEventName(initialData.event_name || '');
          setStartDate(isoToLocalDateTimeInput(initialData.start_date));
          setEndDate(isoToLocalDateTimeInput(initialData.end_date));
          setPaymentStatus(initialData.payment_status || 'not_paid');
          setPaymentAmount(initialData.payment_amount?.toString() || '');
          setReminderAt(initialData.reminder_at ? isoToLocalDateTimeInput(initialData.reminder_at) : '');
          setEmailReminderEnabled(initialData.email_reminder_enabled || false);
          setIsRecurring(initialData.is_recurring || false);
          setRepeatPattern(initialData.repeat_pattern || '');
          setRepeatUntil(initialData.repeat_until ? isoToLocalDateTimeInput(initialData.repeat_until) : '');
          
          // Load additional persons and files for existing events
          const targetEventId = initialData.id;
          if (targetEventId) {
            await loadAdditionalPersons(targetEventId);
            await loadExistingFiles(targetEventId);
          }
        } else if (selectedDate && eventId) {
          console.log('[PublicEventDialog] 📅 Setting up for new event on selected date:', selectedDate);
          // Set default start/end times for new events
          const startDateTime = new Date(selectedDate);
          const endDateTime = new Date(selectedDate);
          endDateTime.setHours(endDateTime.getHours() + 1);
          
          setStartDate(startDateTime.toISOString().slice(0, 16));
          setEndDate(endDateTime.toISOString().slice(0, 16));
          resetFormFields();
        } else {
          resetFormFields();
        }
      }
    };

    loadAndSetEventData();
  }, [open, selectedDate, initialData, eventId, isVirtualEvent]);

  const resetFormFields = () => {
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
    setAdditionalPersons([]);
    setFiles([]);
    setExistingFiles([]);
    setReminderAt("");
    setEmailReminderEnabled(false);
    setCurrentUserProfileName("");
    console.log('[PublicEventDialog] Form fields reset');
  };

  const resetForm = () => {
    resetFormFields();
    setStartDate("");
    setEndDate("");
  };

  // Upload files function for public events
  const uploadFiles = async (targetEventId: string) => {
    return await uploadEventFiles({
      files,
      eventId: targetEventId,
      userId: publicBoardUserId,
      isPublicMode: true
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if this is a recurring event being edited and we need to show the choice dialog
    if ((eventId || initialData) && isRecurringEvent && editChoice === null) {
      setShowEditDialog(true);
      return;
    }
    
    // Continue with the actual submission
    await performSubmit();
  };

  const performSubmit = async () => {
    try {
      if (!startDate || !endDate) {
        toast({
          title: t("common.error"),
          description: "Start date and end date are required",
          variant: "destructive"
        });
        return;
      }

      setIsLoading(true);
      console.log('[PublicEventDialog] 🚀 Starting performSubmit with editChoice:', editChoice);

      if (eventId || initialData) {
        console.log('[PublicEventDialog] 📝 Updating existing event');
        
        // Handle recurring event editing
        if (isRecurringEvent && editChoice) {
          console.log(`[PublicEventDialog] 🔄 Handling recurring event edit: ${editChoice}`);
          
          if (editChoice === "series") {
            console.log('[PublicEventDialog] 📝 Updating entire series');
            // Update the entire series without changing dates/times
            const seriesEventData = {
              user_surname: userSurname,
              user_number: userNumber,
              social_network_link: socialNetworkLink,
              event_notes: eventNotes,
              event_name: eventName,
              payment_status: paymentStatus || 'not_paid',
              payment_amount: paymentAmount || null,
              reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
              email_reminder_enabled: emailReminderEnabled
            };

            const seriesResult = await supabase.rpc('update_event_series', {
              p_event_id: eventId || initialData?.id,
              p_user_id: publicBoardUserId,
              p_event_data: seriesEventData,
              p_additional_persons: additionalPersons.map(person => ({
                userSurname: person.userSurname,
                userNumber: person.userNumber,
                socialNetworkLink: person.socialNetworkLink,
                eventNotes: person.eventNotes,
                paymentStatus: person.paymentStatus,
                paymentAmount: person.paymentAmount
              })),
              p_edited_by_type: 'sub_user',
              p_edited_by_name: externalUserName
            });

            if (seriesResult.error) throw seriesResult.error;

            toast({
              title: t("common.success"),
              description: t("recurring.seriesUpdated")
            });
            
          } else if (editChoice === "this") {
            // Create a new standalone event for "edit only this event"
            let newEventId;
            const { data: createdEventId, error: createError } = await supabase.rpc('save_event_with_persons', {
              p_event_data: {
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
                type: 'event',
                is_recurring: false, // Make it standalone
                repeat_pattern: null,
                repeat_until: null,
                parent_event_id: null, // No parent relationship
                reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
                email_reminder_enabled: emailReminderEnabled,
                language: language || 'en',
                user_id: publicBoardUserId
              },
              p_additional_persons: additionalPersons.map(person => ({
                userSurname: person.userSurname,
                userNumber: person.userNumber,
                socialNetworkLink: person.socialNetworkLink,
                eventNotes: person.eventNotes,
                paymentStatus: person.paymentStatus,
                paymentAmount: person.paymentAmount
              })),
              p_user_id: publicBoardUserId,
              p_event_id: null, // Create new event
              p_created_by_type: 'sub_user',
              p_created_by_name: externalUserName,
              p_last_edited_by_type: 'sub_user',
              p_last_edited_by_name: externalUserName
            });

            if (createError) throw createError;
            newEventId = createdEventId;

            // Soft delete the original instance to remove it from the series
            const originalEventId = eventId || initialData?.id;
            if (originalEventId) {
              await supabase
                .from('events')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', originalEventId)
                .eq('user_id', publicBoardUserId);
            }

            toast({
              title: t("common.success"),
              description: t("events.eventUpdated")
            });
          }

          // Upload files after successful operation
          if (files.length > 0) {
            try {
              const targetEventId = editChoice === "this" ? newEventId : (eventId || initialData?.id);
              if (targetEventId) {
                await uploadFiles(targetEventId);
                setFiles([]);
              }
            } catch (fileError) {
              console.error('[PublicEventDialog] ❌ Error uploading files:', fileError);
              toast({
                title: t("common.warning"),
                description: "Event updated successfully, but some files failed to upload.",
                variant: "destructive"
              });
            }
          }
        } else {
          // Regular event update (non-recurring)
          if (!onSave) throw new Error("Save function not provided");
          
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
            type: 'event',
            is_recurring: false,
            repeat_pattern: null,
            repeat_until: null,
            reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
            email_reminder_enabled: emailReminderEnabled,
            language: language || 'en',
            user_id: publicBoardUserId
          };

          const savedEvent = await onSave({ ...eventData, id: eventId || initialData?.id });
          
          // Save additional persons if any
          if (additionalPersons.length > 0) {
            try {
              console.log('[PublicEventDialog] 📝 Saving additional persons for existing event');
              const additionalPersonsData = additionalPersons.map(person => ({
                userSurname: person.userSurname,
                userNumber: person.userNumber,
                socialNetworkLink: person.socialNetworkLink,
                eventNotes: person.eventNotes,
                paymentStatus: person.paymentStatus,
                paymentAmount: person.paymentAmount
              }));

              const { error: rpcError } = await supabase.rpc('save_event_with_persons', {
                p_event_data: {
                  ...eventData,
                  id: eventId || initialData?.id
                },
                p_additional_persons: additionalPersonsData,
                p_user_id: publicBoardUserId,
                p_event_id: eventId || initialData?.id,
                p_created_by_type: 'sub_user',
                p_created_by_name: externalUserName,
                p_last_edited_by_type: 'sub_user',
                p_last_edited_by_name: externalUserName
              });

              if (rpcError) {
                console.error('[PublicEventDialog] Error saving additional persons:', rpcError);
                throw rpcError;
              }
              
              console.log('[PublicEventDialog] ✅ Additional persons saved successfully');
            } catch (personError) {
              console.error('[PublicEventDialog] ❌ Error saving additional persons:', personError);
              toast({
                title: t("common.warning"),
                description: "Event updated but failed to save additional persons",
                variant: "destructive"
              });
            }
          }
          
          // Upload files after successful event update
          if (files.length > 0) {
            try {
              console.log('[PublicEventDialog] 📤 Starting file upload for event update. Files:', files.length, 'PublicBoardUserId:', publicBoardUserId);
              await uploadFiles(eventId || initialData?.id!);
              console.log('[PublicEventDialog] ✅ Files uploaded successfully after event update');
              
              // Clear files state after successful upload
              setFiles([]);
              
              // Refresh the existing files list to show newly uploaded files
              await loadExistingFiles(eventId || initialData?.id!);
            } catch (fileError) {
              console.error('[PublicEventDialog] ❌ Error uploading files during event update:', fileError);
              toast({
                title: t("common.warning"),
                description: "Event updated successfully, but some files failed to upload. Check console for details.",
                variant: "destructive"
              });
            }
          }
          
          toast({
            title: t("common.success"),
            description: t("events.eventUpdated")
          });

          onEventUpdated?.();
        }
      } else {
        // Create new event
        if (!onSave) throw new Error("Save function not provided");
        
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
          type: 'event',
          is_recurring: isRecurring,
          repeat_pattern: isRecurring ? repeatPattern : null,
          repeat_until: isRecurring && repeatUntil ? localDateTimeInputToISOString(repeatUntil) : null,
          reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
          email_reminder_enabled: emailReminderEnabled,
          language: language || 'en',
          user_id: publicBoardUserId
        };
        
        // Save main event with additional persons using RPC
        let createdEvent;
        if (additionalPersons.length > 0) {
          console.log('[PublicEventDialog] Creating event with additional persons using RPC');
          const additionalPersonsData = additionalPersons.map(person => ({
            userSurname: person.userSurname,
            userNumber: person.userNumber, 
            socialNetworkLink: person.socialNetworkLink,
            eventNotes: person.eventNotes,
            paymentStatus: person.paymentStatus,
            paymentAmount: person.paymentAmount
          }));

          const { data: eventId, error: rpcError } = await supabase.rpc('save_event_with_persons', {
            p_event_data: eventData,
            p_additional_persons: additionalPersonsData,
            p_user_id: publicBoardUserId,
            p_created_by_type: 'sub_user',
            p_created_by_name: externalUserName,
            p_last_edited_by_type: 'sub_user',
            p_last_edited_by_name: externalUserName
          });

          if (rpcError) {
            console.error('[PublicEventDialog] Error creating event with persons via RPC:', rpcError);
            throw rpcError;
          }

          createdEvent = { ...eventData, id: eventId };
          console.log('[PublicEventDialog] ✅ Event with additional persons created via RPC:', createdEvent);
        } else {
          // Create event without additional persons using regular save function
          createdEvent = await onSave(eventData);
          console.log('[PublicEventDialog] ✅ Event created without additional persons:', createdEvent);
        }

        // Upload files after successful event creation
        if (files.length > 0 && createdEvent?.id) {
          try {
            console.log('[PublicEventDialog] 📤 Starting file upload for new event. Files:', files.length, 'PublicBoardUserId:', publicBoardUserId);
            await uploadFiles(createdEvent.id);
            console.log('[PublicEventDialog] ✅ Files uploaded successfully after event creation');
            
            // Clear files state after successful upload
            setFiles([]);
          } catch (fileError) {
            console.error('[PublicEventDialog] ❌ Error uploading files during event creation:', fileError);
            toast({
              title: t("common.warning"),
              description: "Event created successfully, but some files failed to upload. Check console for details.",
              variant: "destructive"
            });
          }
        }

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
      setEditChoice(null); // Reset edit choice for next time
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

  const handleEditThis = () => {
    setEditChoice("this");
    setShowEditDialog(false);
    performSubmit();
  };

  const handleEditSeries = () => {
    setEditChoice("series");
    setShowEditDialog(false);
    performSubmit();
  };

  const handleDeleteThis = async () => {
    if (!eventId && !initialData?.id) return;
    
    setIsLoading(true);
    try {
      if (!onDelete) throw new Error("Delete function not provided");
      
      await onDelete({ id: eventId || initialData?.id!, deleteChoice: "this" });
      
      toast({
        title: t("common.success"),
        description: t("events.eventDeleted")
      });
      
      setShowDeleteDialog(false);
      onOpenChange(false);
      onEventDeleted?.();
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
    
    setIsLoading(true);
    try {
      if (!onDelete) throw new Error("Delete function not provided");
      
      await onDelete({ id: eventId || initialData?.id!, deleteChoice: "series" });
      
      toast({
        title: t("common.success"),
        description: t("recurring.seriesDeleted")
      });
      
      setShowDeleteDialog(false);
      onOpenChange(false);
      onEventDeleted?.();
    } catch (error: any) {
      console.error('[PublicEventDialog] Error deleting series:', error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete series",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {eventId || initialData ? t("events.editEvent") : t("events.createEvent")}
              {isRecurringEvent && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <RefreshCcw className="h-4 w-4" />
                  {t("recurring.recurringEvent")}
                </div>
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
              reminderAt={reminderAt}
              setReminderAt={setReminderAt}
              emailReminderEnabled={emailReminderEnabled}
              setEmailReminderEnabled={setEmailReminderEnabled}
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              repeatPattern={repeatPattern}
              setRepeatPattern={setRepeatPattern}
              repeatUntil={repeatUntil}
              setRepeatUntil={setRepeatUntil}
              additionalPersons={additionalPersons}
              setAdditionalPersons={setAdditionalPersons}
              files={files}
              setFiles={setFiles}
              existingFiles={existingFiles}
              setExistingFiles={setExistingFiles}
              currentUserProfileName={currentUserProfileName}
              isPublicDialog={true}
              publicBoardUserId={publicBoardUserId}
              externalUserName={externalUserName}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {t("common.cancel")}
              </Button>
              {(eventId || initialData) && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isLoading}
                >
                  {t("common.delete")}
                </Button>
              )}
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t("common.saving") : (eventId || initialData ? t("common.update") : t("common.create"))}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onDeleteThis={handleDeleteThis}
        onDeleteSeries={handleDeleteSeries}
        isRecurringEvent={!!isRecurringEvent}
        isLoading={isLoading}
      />

      <RecurringEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onEditThis={handleEditThis}
        onEditSeries={handleEditSeries}
        isRecurringEvent={!!isRecurringEvent}
        isLoading={isLoading}
      />
    </>
  );
};