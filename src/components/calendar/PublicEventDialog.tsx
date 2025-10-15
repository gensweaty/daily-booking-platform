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
import { formatAttribution } from "@/lib/metadata";

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

// Helper to derive the precise original occurrence window for "Edit this" instances
const deriveOriginalInstanceWindow = (d: CalendarEventType, key: string) => {
  const baseStart = new Date(d.start_date);
  const baseEnd = new Date(d.end_date);

  // 1) virtual id → instance date
  let instanceDate: string | null = isVirtualInstance(key) ? getInstanceDate(key) : null;

  // 2) fallback to explicit instance date from row
  if (!instanceDate && d.recurrence_instance_date) {
    instanceDate = d.recurrence_instance_date.slice(0, 10); // YYYY-MM-DD
  }

  if (instanceDate) {
    const [y, m, day] = instanceDate.split('-').map(Number);
    const instStart = new Date(baseStart); 
    instStart.setFullYear(y, m - 1, day);
    const instEnd = new Date(baseEnd);     
    instEnd.setFullYear(y, m - 1, day);
    return { startISO: instStart.toISOString(), endISO: instEnd.toISOString() };
  }

  // fallback: parent's base window
  return { startISO: baseStart.toISOString(), endISO: baseEnd.toISOString() };
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
  const [showEditDialog, setShowEditDialog] = useState(false);
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
  const [currentUserProfileName, setCurrentUserProfileName] = useState<string>("");
  const [editChoice, setEditChoice] = useState<"this" | "series" | null>(null);
  const [originalInstanceStartISO, setOriginalInstanceStartISO] = useState<string | null>(null);
  const [originalInstanceEndISO, setOriginalInstanceEndISO] = useState<string | null>(null);

  const isNewEvent = !initialData && !eventId;
  // CRITICAL: Detect virtual instance from either source
  const eventKey = eventId || initialData?.id || "";
  const isVirtualEvent = !!eventKey && isVirtualInstance(eventKey);
  const isRecurringEvent = (initialData?.is_recurring || isVirtualEvent || initialData?.parent_event_id) && !isNewEvent;

  // Resolve the real series root (parent) id regardless of what was clicked
  const resolveSeriesRootId = React.useCallback(() => {
    const key = eventId || initialData?.id || "";
    if (!key) return "";
    if (isVirtualInstance(key)) return getParentEventId(key);
    if (initialData?.parent_event_id) return initialData.parent_event_id;
    return key;
  }, [eventId, initialData]);
  
  // Check if current user is the creator of this event
  const isEventCreatedByCurrentUser = initialData ? 
    (initialData.created_by_type === 'sub_user' && initialData.created_by_name === externalUserName) ||
    (initialData.created_by_type !== 'sub_user' && initialData.created_by_type !== 'admin') : true;

  // Fetch current user's profile username for display
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      if (!publicBoardUserId) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', publicBoardUserId)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching current user profile:', error);
          return;
        }
        
        if (data?.username) {
          setCurrentUserProfileName(data.username);
        }
      } catch (err) {
        console.error('Exception fetching current user profile:', err);
      }
    };
    
    fetchCurrentUserProfile();
  }, [publicBoardUserId]);

  // Load additional persons for event
  const loadAdditionalPersons = async (targetEventId: string) => {
    try {
      let actualEventId = targetEventId;

      if (isVirtualInstance(targetEventId)) {
        actualEventId = getParentEventId(targetEventId);
        console.log('🔍 [PublicEventDialog] Virtual instance detected, using parent ID:', actualEventId);
      } else if (initialData?.parent_event_id) {
        actualEventId = initialData.parent_event_id;
        console.log('🔍 [PublicEventDialog] Child instance detected, using parent ID:', actualEventId);
      } else if (initialData?.is_recurring && !initialData?.parent_event_id) {
        actualEventId = targetEventId;
        console.log('🔍 [PublicEventDialog] Parent recurring event, using own ID:', actualEventId);
      }

      console.log('🔍 [PublicEventDialog] Loading additional persons:', {
        targetEventId,
        actualEventId,
        isVirtualEvent,
        parentEventId: initialData?.parent_event_id,
        isRecurring: initialData?.is_recurring,
        publicBoardUserId,
        isAuthenticated: !!supabase.auth.getUser()
      });

      // Enhanced debugging with explicit RLS context check
      if (publicBoardUserId) {
        const debugResult = await supabase.rpc('debug_customers_access', {
          p_event_id: actualEventId,
          p_user_id: publicBoardUserId
        });
        console.log('🔧 [PublicEventDialog] Debug customers access:', debugResult);
      }

      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('event_id', actualEventId)
        .eq('type', 'customer')
        .is('deleted_at', null);

      if (error) {
        console.error('[PublicEventDialog] Error loading additional persons:', error);
        return;
      }

      if (customers && customers.length > 0) {
        const mappedPersons = customers.map(customer => ({
          id: customer.id,
          userSurname: customer.user_surname || customer.title || '',
          userNumber: customer.user_number || '',
          socialNetworkLink: customer.social_network_link || '',
          eventNotes: customer.event_notes || '',
          paymentStatus: customer.payment_status || '',
          paymentAmount: customer.payment_amount?.toString() || ''
        }));
        console.log('✅ [PublicEventDialog] Loaded additional persons:', mappedPersons.length, 'persons for actualEventId:', actualEventId);
        setAdditionalPersons(mappedPersons);
      } else {
        console.log('ℹ️ [PublicEventDialog] No additional persons found for actualEventId:', actualEventId);
        setAdditionalPersons([]);
      }
    } catch (error) {
      console.error('[PublicEventDialog] Error loading additional persons:', error);
    }
  };

  // Load existing files for event
  const loadExistingFiles = async (targetEventId: string) => {
    try {
      let actualEventId = targetEventId;

      if (isVirtualInstance(targetEventId)) {
        actualEventId = getParentEventId(targetEventId);
        console.log('📁 [PublicEventDialog] Virtual instance detected, using parent ID for files:', actualEventId);
      } else if (initialData?.parent_event_id) {
        actualEventId = initialData.parent_event_id;
        console.log('📁 [PublicEventDialog] Child instance detected, using parent ID for files:', actualEventId);
      } else if (initialData?.is_recurring && !initialData?.parent_event_id) {
        actualEventId = targetEventId;
        console.log('📁 [PublicEventDialog] Parent recurring event, using own ID for files:', actualEventId);
      }

      console.log('📁 [PublicEventDialog] Loading existing files:', {
        targetEventId,
        actualEventId,
        isVirtualEvent,
        parentEventId: initialData?.parent_event_id,
        isRecurring: initialData?.is_recurring
      });

      const eventFiles = await loadEventFiles(actualEventId);
      setExistingFiles(eventFiles);
    } catch (error) {
      console.error('[PublicEventDialog] Error loading existing files:', error);
    }
  };

  // Initialize form data
  useEffect(() => {
    // Reset dialog states when opening
    setEditChoice(null);
    setShowEditDialog(false);
    setShowDeleteDialog(false);
    setIsLoading(false);
    
    const loadAndSetEventData = async () => {
      if (open) {
        if (initialData || eventId) {
          const targetEventId = eventId || initialData?.id;
          const eventData = initialData;
          
          // Load existing files and additional persons if we have an event ID
          if (targetEventId) {
            await loadExistingFiles(targetEventId);
            await loadAdditionalPersons(targetEventId);
          }
          
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

            // CRITICAL: Derive the original occurrence window using the surgical fix utility
            const { startISO, endISO } = deriveOriginalInstanceWindow(eventData, eventKey);
            setOriginalInstanceStartISO(startISO);
            setOriginalInstanceEndISO(endISO);
            
            // Set the visible form dates (user can edit these)
            setStartDate(isoToLocalDateTimeInput(startISO));
            setEndDate(isoToLocalDateTimeInput(endISO));
            
            console.log('[PublicEventDialog] 🗓️ Set instance window:', {
              eventKey,
              isVirtual: isVirtualInstance(eventKey),
              hasRecurrenceDate: !!eventData.recurrence_instance_date,
              originalStart: startISO,
              originalEnd: endISO
            });

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
  }, [open, selectedDate, initialData, eventId]); // FIXED: Removed isVirtualEvent from dependencies

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
    await uploadEventFiles({
      files,
      eventId: targetEventId,
      userId: publicBoardUserId,
      isPublicMode: true
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[PublicEventDialog] submit - debugging recurring event logic:', {
      eventId,
      hasInitialData: !!initialData,
      isRecurringEvent,
      editChoice,
      isRecurring: initialData?.is_recurring,
      isVirtualEvent,
      hasParentId: !!initialData?.parent_event_id
    });
    
    // Check if this is a recurring event being edited and we need to show the choice dialog
    if ((eventId || initialData) && isRecurringEvent && editChoice === null) {
      console.log('[PublicEventDialog] Showing RecurringEditDialog for event edit choice');
      setShowEditDialog(true);
      return;
    }
    
    // Continue with the actual submission
    await performSubmit();
  };

  const performSubmit = async (forcedChoice?: "this" | "series") => {
    
    if (!startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: "Start date and end date are required",
        variant: "destructive"
      });
      return;
    }
    
    const choice = forcedChoice ?? editChoice;

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
        // Update existing event with new safe functions
        const targetEventId = eventId || initialData?.id;
        if (!targetEventId) throw new Error("No event ID available for update");
        
        console.log('[PublicEventDialog] Updating event:', targetEventId, 'editChoice:', editChoice, 'isRecurringEvent:', isRecurringEvent);

        const additionalPersonsData = additionalPersons.map(person => ({
          userSurname: person.userSurname,
          userNumber: person.userNumber, 
          socialNetworkLink: person.socialNetworkLink,
          eventNotes: person.eventNotes,
          paymentStatus: person.paymentStatus,
          paymentAmount: person.paymentAmount
        }));

        // EDIT EXISTING
        if (isRecurringEvent) {
          // Force a choice; do NOT fall back to single-row update
          if (!choice) {
            setShowEditDialog(true);
            setIsLoading(false);
            return;
          }

          if (choice === "series") {
            console.log('[PublicEventDialog] Updating entire series safely (preserving individual dates)');

            const seriesTargetId = resolveSeriesRootId();
            
            // NEW: strip date/recurrence fields so neither RPC nor local merge can reschedule the root
            const safeSeriesData = {
              title: userSurname || title || 'Untitled Event',
              user_surname: userSurname,
              user_number: userNumber,
              social_network_link: socialNetworkLink,
              event_notes: eventNotes,
              event_name: eventName,
              payment_status: paymentStatus || 'not_paid',
              payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
              reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
              email_reminder_enabled: emailReminderEnabled
              // ⚠️ intentionally no start/end/recurrence fields here
            };

            const { data: updateResult, error: updateSeriesError } = await supabase.rpc('update_event_series_safe', {
              p_event_id: seriesTargetId,
              p_user_id: publicBoardUserId,
              p_event_data: safeSeriesData,
              p_additional_persons: additionalPersonsData,
              p_edited_by_type: 'sub_user',
              p_edited_by_name: externalUserName,
              p_edited_by_ai: false
            });

            if (updateSeriesError) throw updateSeriesError;
            if (!updateResult?.success) throw new Error(updateResult?.error || 'Failed to update series');

            // Always show success toast and notify parent
            toast({ 
              title: t("common.success"), 
              description: t("events.eventSeriesUpdated") || "Event series updated successfully" 
            });
            onEventUpdated?.();

            // file upload stays against series root (unchanged)
            if (files.length > 0) {
              try {
                await uploadFiles(seriesTargetId);
                setFiles([]);
                await loadExistingFiles(seriesTargetId);
              } catch (fileError) {
                console.error('[PublicEventDialog] ❌ File upload during series update:', fileError);
                toast({ title: t("common.warning"), description: "Series updated, but some files failed to upload", variant: "destructive" });
              }
            }
          } else {
            // edit only this instance -> split + exclude
            console.log('[PublicEventDialog] Creating standalone event from series instance (surgical v2)');
            
            // 1) If this dialog is already editing a split child (not a virtual ID), just UPDATE it.
            //    (Avoid creating a second standalone + exclusion)
            if (!isVirtualEvent && initialData?.parent_event_id && !initialData?.excluded_from_series) {
              const childId = initialData.id || targetEventId;
              const { error: updErr } = await supabase.rpc('save_event_with_persons', {
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
                  payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
                  reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
                  email_reminder_enabled: emailReminderEnabled,
                  language: language || 'en',
                  id: childId
                },
                p_additional_persons: additionalPersonsData,
                p_user_id: publicBoardUserId,
                p_event_id: childId,
                p_created_by_type: 'sub_user',
                p_created_by_name: externalUserName,
                p_created_by_ai: false,
                p_last_edited_by_type: 'sub_user',
                p_last_edited_by_name: externalUserName,
                p_last_edited_by_ai: false
              });
              if (updErr) throw updErr;
              
              // Always show success toast and notify parent
              toast({ 
                title: t("common.success"), 
                description: t("events.eventUpdated") || "Event updated successfully" 
              });
              onEventUpdated?.();
            } else {
              // 2) Virtual instance -> split + exclude using the ORIGINAL occurrence window
              const rpcTargetId = isVirtualEvent ? getParentEventId(eventKey) : targetEventId;

              const { data: editResult, error: editError } = await supabase.rpc('edit_single_event_instance_v2', {
                p_event_id: rpcTargetId,
                p_user_id: publicBoardUserId,
                // NEW: include the NEW desired times on the standalone
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
                  payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
                  reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
                  email_reminder_enabled: emailReminderEnabled,
                  language: language || 'en'
                },
                p_additional_persons: additionalPersonsData,
                // CRITICAL: Always use the derived original window, never the edited values
                p_instance_start: originalInstanceStartISO!,
                p_instance_end: originalInstanceEndISO!,
                p_edited_by_type: 'sub_user',
                p_edited_by_name: externalUserName,
                p_edited_by_ai: false
              });

              if (editError) throw editError;
              if (!editResult?.success) throw new Error(editResult?.error || 'Failed to edit single instance');

              // Always show success toast and notify parent
              toast({ 
                title: t("common.success"), 
                description: t("events.eventUpdated") || "Event updated successfully" 
              });
              onEventUpdated?.();

              const newEventId = editResult.new_event_id;
              if (files.length && newEventId) {
                await uploadFiles(newEventId);
                setFiles([]);
                await loadExistingFiles(newEventId);
              }
            }
          }

          resetForm();
          onOpenChange(false);
          setEditChoice(null);
          setIsLoading(false);
          return;
        }

        // Non-recurring edit (simple single-row update)
        if (!onUpdate) throw new Error("Update function not provided");
        
        const updatedEvent = await onUpdate({
          ...eventData,
          id: targetEventId
        });
        
        console.log('[PublicEventDialog] Event updated successfully (legacy):', updatedEvent);
        
        // Save additional persons for regular events
        if (additionalPersonsData.length > 0) {
          const { error: rpcError } = await supabase.rpc('save_event_with_persons', {
            p_event_data: {
              ...eventData,
              id: targetEventId
            },
            p_additional_persons: additionalPersonsData,
            p_user_id: publicBoardUserId,
            p_event_id: targetEventId,
            p_created_by_type: 'sub_user',
            p_created_by_name: externalUserName,
            p_created_by_ai: false,
            p_last_edited_by_type: 'sub_user',
            p_last_edited_by_name: externalUserName,
            p_last_edited_by_ai: false
          });

          if (rpcError) throw rpcError;
          console.log('[PublicEventDialog] Additional persons saved successfully');
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
      } else {
        // Create new event
        if (!onSave) throw new Error("Save function not provided");
        
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
            p_created_by_ai: false,
            p_last_edited_by_type: 'sub_user',
            p_last_edited_by_name: externalUserName,
            p_last_edited_by_ai: false
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
    performSubmit("this");
  };

  const handleEditSeries = () => {
    setEditChoice("series");
    setShowEditDialog(false);
    performSubmit("series");
  };

  const handleDeleteThis = async () => {
    if (!eventId && !initialData?.id) return;
    
    setIsLoading(true);
    try {
      if (isRecurringEvent) {
        // Single-instance delete for recurring series -> insert exclusion marker
        const parentId = resolveSeriesRootId();
        const instanceIsoStart = localDateTimeInputToISOString(startDate);
        const instanceIsoEnd = localDateTimeInputToISOString(endDate);

        const { error: exErr } = await supabase
          .from('events')
          .insert({
            title: currentEventData?.title || title || 'Excluded instance',
            user_surname: currentEventData?.user_surname || userSurname || null,
            user_number: currentEventData?.user_number || userNumber || null,
            social_network_link: currentEventData?.social_network_link || socialNetworkLink || null,
            event_notes: currentEventData?.event_notes || eventNotes || null,
            event_name: currentEventData?.event_name || eventName || null,
            start_date: instanceIsoStart,
            end_date: instanceIsoEnd,
            user_id: publicBoardUserId,
            parent_event_id: parentId,
            excluded_from_series: true,
            created_by_type: 'sub_user',
            created_by_name: externalUserName,
            last_edited_by_type: 'sub_user',
            last_edited_by_name: externalUserName,
          });
        if (exErr) throw exErr;

        toast({
          title: t("common.success"),
          description: t("events.eventDeleted")
        });
      } else {
        // Non-recurring: use callback or fallback to direct delete
        if (onDelete) {
          await onDelete({ 
            id: eventId || initialData!.id, 
            deleteChoice: 'this' 
          });
        } else {
          // Fallback direct delete
          const { error } = await supabase
            .from('events')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', eventId || initialData?.id);
          if (error) throw error;
        }

        toast({
          title: t("common.success"),
          description: t("events.eventDeleted")
        });
      }

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
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full"
        onEscapeKeyDown={(e) => { if (showEditDialog || showDeleteDialog) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (showEditDialog || showDeleteDialog) e.preventDefault(); }}
      >
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
              currentUserName={currentUserProfileName}
              currentUserType={currentUserProfileName ? 'sub_user' : 'admin'}
              isSubUser={!!currentUserProfileName}
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
                            ? `${formatAttribution((currentEventData || initialData)?.created_by_name, (currentEventData || initialData)?.created_by_type, (currentEventData || initialData)?.created_by_ai)}-ს ${t("common.by")}` 
                            : `${t("common.by")} ${formatAttribution((currentEventData || initialData)?.created_by_name, (currentEventData || initialData)?.created_by_type, (currentEventData || initialData)?.created_by_ai)}`}
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
                            ? `${formatAttribution((currentEventData || initialData)?.last_edited_by_name, (currentEventData || initialData)?.last_edited_by_type, (currentEventData || initialData)?.last_edited_by_ai)}-ს ${t("common.by")}` 
                            : `${t("common.by")} ${formatAttribution((currentEventData || initialData)?.last_edited_by_name, (currentEventData || initialData)?.last_edited_by_type, (currentEventData || initialData)?.last_edited_by_ai)}`}
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

      <RecurringEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onEditThis={handleEditThis}
        onEditSeries={handleEditSeries}
        isRecurringEvent={isRecurringEvent}
        isLoading={isLoading}
      />
    </>
  );
};