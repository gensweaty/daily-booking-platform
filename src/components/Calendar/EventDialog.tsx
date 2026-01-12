import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarEvent } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EventDialogFields } from "./EventDialogFields";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { RecurringEditDialog } from "./RecurringEditDialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { sendEventCreationEmail } from "@/lib/api";
import { isVirtualInstance, getParentEventId, getInstanceDate } from "@/lib/recurringEvents";
import { deleteCalendarEvent, clearCalendarCache } from "@/services/calendarService";
import { Clock, RefreshCcw, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useSubUserPermissions } from "@/hooks/useSubUserPermissions";
import { uploadEventFiles, loadEventFiles } from "@/utils/eventFileUpload";
import { formatAttribution } from "@/lib/metadata";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  eventId?: string;
  initialData?: CalendarEvent;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
  // Public board context props
  publicBoardUserId?: string;
  externalUserName?: string;
  isPublicMode?: boolean;
  // Legacy props for backward compatibility
  isOpen?: boolean;
  onClose?: () => void;
  onSave?: (data: any) => Promise<any>;
}

// Helper function to check if two time ranges overlap
const timeRangesOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
  return start1 < end2 && end1 > start2;
};

// Helper function to generate recurring event occurrences for conflict checking
const generateRecurringOccurrences = (startDate: Date, endDate: Date, repeatPattern: string, repeatUntil: string): Array<{ start: Date; end: Date }> => {
  const occurrences = [];
  const duration = endDate.getTime() - startDate.getTime();
  const endLimit = new Date(repeatUntil);
  let currentDate = new Date(startDate);

  // Limit to prevent infinite loops - max 100 occurrences
  let count = 0;
  const maxOccurrences = 100;

  while (currentDate <= endLimit && count < maxOccurrences) {
    const occurrenceEnd = new Date(currentDate.getTime() + duration);
    occurrences.push({
      start: new Date(currentDate),
      end: occurrenceEnd
    });

    // Calculate next occurrence based on pattern
    switch (repeatPattern) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        break;
    }

    count++;
  }

  return occurrences;
};

// CRITICAL FIX: Convert datetime-local input to UTC ISO string
const localDateTimeInputToISOString = (localDateTime: string): string => {
  if (!localDateTime) return new Date().toISOString();
  
  try {
    // Create date from local datetime-local input value
    const localDate = new Date(localDateTime);
    const isoString = localDate.toISOString();
    
    console.log('📅 Local to ISO conversion:', { 
      localDateTime, 
      localDate: localDate.toString(),
      isoString,
      timezoneOffset: localDate.getTimezoneOffset()
    });
    
    return isoString;
  } catch (error) {
    console.error('Error converting local datetime to ISO:', error, 'Input:', localDateTime);
    return new Date().toISOString();
  }
};

// CRITICAL FIX: Convert UTC ISO string to local datetime-local format
const isoToLocalDateTimeInput = (isoString: string): string => {
  if (!isoString || isoString === 'null' || isoString === '') return '';
  
  try {
    const date = new Date(isoString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to isoToLocalDateTimeInput:', isoString);
      return '';
    }
    
    // Convert UTC to local time for datetime-local input
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISO = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    
    console.log('📅 Date conversion:', { 
      isoString, 
      utcDate: date.toISOString(), 
      localISO,
      timezoneOffset: date.getTimezoneOffset() 
    });
    return localISO;
  } catch (error) {
    console.error('Error converting ISO date to input format:', error, 'Input:', isoString);
    return '';
  }
};

export const EventDialog = ({
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
  isPublicMode = false,
  // Legacy props with defaults
  isOpen = false,
  onClose = () => {},
  onSave
}: EventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { isSubUser } = useSubUserPermissions();
  
  // Helper function to get the effective user ID for operations
  const getEffectiveUserId = () => {
    if (isPublicMode && publicBoardUserId) {
      return publicBoardUserId;
    }
    return user?.id;
  };
  
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
  const [currentEventData, setCurrentEventData] = useState<CalendarEvent | null>(null);
  const [reminderAt, setReminderAt] = useState("");
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [currentUserProfileName, setCurrentUserProfileName] = useState<string>("");
  const [currentSubUserFullName, setCurrentSubUserFullName] = useState<string>("");
  const [editChoice, setEditChoice] = useState<"this" | "series" | null>(null);
  const [originalInstanceStartISO, setOriginalInstanceStartISO] = useState<string | null>(null);
  const [originalInstanceEndISO, setOriginalInstanceEndISO] = useState<string | null>(null);

  const isNewEvent = !initialData && !eventId;
  // CRITICAL: Detect virtual instance from either source
  const eventKey = eventId || initialData?.id || "";
  const isVirtualEvent = !!eventKey && isVirtualInstance(eventKey);
  // CRITICAL: Excluded events are standalone, not part of a recurring series
  const isRecurringEvent = (initialData?.is_recurring || isVirtualEvent || initialData?.parent_event_id) && !isNewEvent && !initialData?.excluded_from_series;

  // Resolve the real series root (parent) id regardless of what was clicked
  const resolveSeriesRootId = React.useCallback(() => {
    const key = eventId || initialData?.id || "";
    if (!key) return "";
    if (isVirtualInstance(key)) return getParentEventId(key);
    if (initialData?.parent_event_id) return initialData.parent_event_id;
    return key;
  }, [eventId, initialData]);

  // Fetch current user's profile username for display
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching current user profile:', error);
          return;
        }
        
        if (data?.username) {
          setCurrentUserProfileName(data.username);
        }
        
        // If sub-user, also fetch their full name
        if (isSubUser && user.email) {
          const effectiveUserId = getEffectiveUserId();
          const { data: subUserData } = await supabase
            .from('sub_users')
            .select('fullname')
            .eq('board_owner_id', effectiveUserId)
            .ilike('email', user.email)
            .maybeSingle();
            
          if (subUserData?.fullname) {
            setCurrentSubUserFullName(subUserData.fullname);
          }
        }
      } catch (err) {
        console.error('Exception fetching current user profile:', err);
      }
    };
    
    fetchCurrentUserProfile();
  }, [user?.id, isSubUser]);


  const loadAdditionalPersons = async (targetEventId: string) => {
    try {
      let actualEventId = targetEventId;

      if (isVirtualInstance(targetEventId)) {
        actualEventId = getParentEventId(targetEventId);
        console.log('🔍 Virtual instance detected, using parent ID:', actualEventId);
      } else if (initialData?.parent_event_id) {
        actualEventId = initialData.parent_event_id;
        console.log('🔍 Child instance detected, using parent ID:', actualEventId);
      } else if (initialData?.is_recurring && !initialData?.parent_event_id) {
        actualEventId = targetEventId;
        console.log('🔍 Parent recurring event, using own ID:', actualEventId);
      }

      console.log('🔍 Loading additional persons:', {
        targetEventId,
        actualEventId,
        isVirtualEvent,
        parentEventId: initialData?.parent_event_id,
        isRecurring: initialData?.is_recurring
      });

      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('event_id', actualEventId)
        .eq('type', 'customer')
        .is('deleted_at', null);

      if (error) {
        console.error('Error loading additional persons:', error);
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
        console.log('✅ Loaded additional persons:', mappedPersons.length, 'persons for actualEventId:', actualEventId);
        setAdditionalPersons(mappedPersons);
      } else {
        console.log('ℹ️ No additional persons found for actualEventId:', actualEventId);
        setAdditionalPersons([]);
      }
    } catch (error) {
      console.error('Error loading additional persons:', error);
    }
  };

  const loadExistingFiles = async (targetEventId: string) => {
    try {
      let actualEventId = targetEventId;

      if (isVirtualInstance(targetEventId)) {
        actualEventId = getParentEventId(targetEventId);
        console.log('📁 Virtual instance detected, using parent ID for files:', actualEventId);
      } else if (initialData?.parent_event_id) {
        actualEventId = initialData.parent_event_id;
        console.log('📁 Child instance detected, using parent ID for files:', actualEventId);
      } else if (initialData?.is_recurring && !initialData?.parent_event_id) {
        actualEventId = targetEventId;
        console.log('📁 Parent recurring event, using own ID for files:', actualEventId);
      }

      console.log('📁 Loading existing files:', {
        targetEventId,
        actualEventId,
        isVirtualEvent,
        parentEventId: initialData?.parent_event_id,
        isRecurring: initialData?.is_recurring
      });

      const eventFiles = await loadEventFiles(actualEventId);
      setExistingFiles(eventFiles);
    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  };

  const loadEventData = async (targetEventId: string) => {
    try {
      const realId = isVirtualInstance(targetEventId)
        ? getParentEventId(targetEventId)
        : targetEventId;
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', realId)
        .single();

      if (error) {
        console.error('Error loading event data:', error);
        return null;
      }

      console.log('✅ Loaded fresh event data:', eventData);
      setCurrentEventData(eventData);
      return eventData;
    } catch (error) {
      console.error('Error loading event data:', error);
      return null;
    }
  };

  // CRITICAL FIX: Enhanced form initialization with proper reminder data loading
  // Use a ref to track if we've already loaded data for this event
  const loadedEventRef = React.useRef<string | null>(null);
  
  useEffect(() => {
    // CRITICAL: Clear the ref when dialog closes to ensure fresh data on next open
    if (!open) {
      loadedEventRef.current = null;
      return;
    }
    
    // CRITICAL: Don't reset dialog states if they're currently open
    // This prevents the dialogs from closing when real-time updates occur
    if (!showEditDialog && !showDeleteDialog) {
      setEditChoice(null);
      setShowEditDialog(false);
      setShowDeleteDialog(false);
      setIsLoading(false);
    }
    
    const loadAndSetEventData = async () => {
      if (open) {
        if (initialData || eventId) {
          const targetEventId = eventId || initialData?.id;
          
          // CRITICAL FIX: Always reload if event ID changed or if ref is null
          if (loadedEventRef.current === targetEventId && loadedEventRef.current !== null) {
            console.log('🔒 Skipping reload - event already loaded:', targetEventId);
            return;
          }
          
          loadedEventRef.current = targetEventId;
          let eventData = initialData;
          
          // CRITICAL: Load fresh data for edit mode to get latest reminder info
          if (targetEventId) {
            const freshData = await loadEventData(targetEventId);
            if (freshData) {
              eventData = freshData;
            }
            loadExistingFiles(targetEventId);
            loadAdditionalPersons(targetEventId);
          }

          if (isVirtualEvent && eventId) {
            const parentId = getParentEventId(eventId);
            loadParentEventData(parentId);
          }

          if (eventData) {
            console.log('🔧 Loading event data for editing:', eventData);
            console.log('🔧 Raw reminder_at from DB:', eventData.reminder_at);
            console.log('🔧 Raw email_reminder_enabled from DB:', eventData.email_reminder_enabled);
            
            setTitle(eventData.title || "");
            setUserSurname(eventData.user_surname || "");
            setUserNumber(eventData.user_number || "");
            setSocialNetworkLink(eventData.social_network_link || "");
            setEventNotes(eventData.event_notes || "");
            setEventName(eventData.event_name || "");
            setPaymentStatus(eventData.payment_status || "");
            setPaymentAmount(eventData.payment_amount?.toString() || "");

            // CRITICAL: Enhanced virtual instance date handling for both eventId and initialData.id
            const isCurrentlyVirtual = !!eventKey && isVirtualInstance(eventKey);
            if (isCurrentlyVirtual && (initialData || eventId)) {
              const instanceDate = getInstanceDate(eventKey);
              if (instanceDate) {
                // Calculate the instance dates using parent's base time but instance's date
                const baseStart = new Date(eventData.start_date);
                const baseEnd = new Date(eventData.end_date);
                const [year, month, day] = instanceDate.split('-').map(n => +n);
                const newStart = new Date(baseStart);
                newStart.setFullYear(year, month - 1, day);
                const newEnd = new Date(baseEnd);
                newEnd.setFullYear(year, month - 1, day);

                setStartDate(isoToLocalDateTimeInput(newStart.toISOString()));
                setEndDate(isoToLocalDateTimeInput(newEnd.toISOString()));

                // ⭐ capture the original occurrence (the one to exclude)
                setOriginalInstanceStartISO(newStart.toISOString());
                setOriginalInstanceEndISO(newEnd.toISOString());
                console.log('🗓️ Set virtual instance dates:', instanceDate, 'Start:', newStart.toISOString());
              } else {
                setStartDate(isoToLocalDateTimeInput(eventData.start_date));
                setEndDate(isoToLocalDateTimeInput(eventData.end_date));
                setOriginalInstanceStartISO(null);
                setOriginalInstanceEndISO(null);
              }
            } else {
              setStartDate(isoToLocalDateTimeInput(eventData.start_date));
              setEndDate(isoToLocalDateTimeInput(eventData.end_date));
              setOriginalInstanceStartISO(null);
              setOriginalInstanceEndISO(null);
            }

            setIsRecurring(eventData.is_recurring || false);
            setRepeatPattern(eventData.repeat_pattern || "");
            setRepeatUntil(eventData.repeat_until || "");
            
            // CRITICAL FIX: Properly load and set reminder fields with enhanced logging
            const reminderValue = eventData.reminder_at;
            console.log('📅 Processing reminder_at value:', reminderValue, 'Type:', typeof reminderValue);
            
            if (reminderValue && reminderValue !== null && reminderValue !== 'null') {
              const convertedReminder = isoToLocalDateTimeInput(reminderValue);
              setReminderAt(convertedReminder);
              console.log('📅 Set reminderAt to:', convertedReminder);
            } else {
              setReminderAt("");
              console.log('📅 No valid reminder_at found, set to empty');
            }
            
            const emailReminderValue = eventData.email_reminder_enabled;
            setEmailReminderEnabled(Boolean(emailReminderValue));
            console.log('📧 Set emailReminderEnabled to:', Boolean(emailReminderValue));
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
  }, [open, selectedDate, eventId, initialData?.id]); // CRITICAL FIX: Watch eventId and initialData.id, not full initialData object
  
  // Reset the loaded event ref and form fields when dialog closes
  useEffect(() => {
    if (!open) {
      loadedEventRef.current = null;
      // Reset form to clean state for next open
      setAdditionalPersons([]);
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setEventName("");
      setPaymentStatus("");
      setPaymentAmount("");
      setStartDate("");
      setEndDate("");
      setIsRecurring(false);
      setRepeatPattern("");
      setRepeatUntil("");
      setFiles([]);
      setExistingFiles([]);
      setReminderAt("");
      setEmailReminderEnabled(false);
      setCurrentEventData(null);
    }
  }, [open]);

  // CRITICAL FIX: Separate function to reset form fields
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
    console.log('🔄 Form fields reset');
  };

  const loadParentEventData = async (parentId: string) => {
    try {
      const { data: parentEvent, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', parentId)
        .single();

      if (error) throw error;

      if (parentEvent) {
        setIsRecurring(parentEvent.is_recurring || false);
        setRepeatPattern(parentEvent.repeat_pattern || "");
        setRepeatUntil(parentEvent.repeat_until || "");
      }
    } catch (error) {
      console.error('Error loading parent event:', error);
    }
  };

  const resetForm = () => {
    resetFormFields();
    setStartDate("");
    setEndDate("");
  };

  const uploadFiles = async (eventId: string) => {
    await uploadEventFiles({
      files,
      eventId,
      userId: getEffectiveUserId(),
      isPublicMode: false
    });
  };

  const sendEmailToAllPersons = async (eventData: any, additionalPersons: any[] = []) => {
    try {
      console.log(`🔔 Starting email notification process for event: ${eventData.title || eventData.user_surname}`);

      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', getEffectiveUserId())
        .maybeSingle();

      if (!businessData) {
        console.warn("❌ Missing business data for event notification - skipping email");
        return;
      }

      const recipients: Array<{
        email: string;
        name: string;
        paymentStatus: string;
        paymentAmount: number | null;
        eventNotes: string;
      }> = [];

      const mainCustomerEmail = eventData.social_network_link;
      if (mainCustomerEmail && isValidEmail(mainCustomerEmail)) {
        recipients.push({
          email: mainCustomerEmail,
          name: eventData.title || eventData.user_surname || '',
          paymentStatus: eventData.payment_status || 'not_paid',
          paymentAmount: eventData.payment_amount || null,
          eventNotes: eventData.event_notes || ''
        });
      }

      if (additionalPersons && additionalPersons.length > 0) {
        additionalPersons.forEach(person => {
          if (person.socialNetworkLink && isValidEmail(person.socialNetworkLink)) {
            recipients.push({
              email: person.socialNetworkLink,
              name: person.userSurname || '',
              paymentStatus: person.paymentStatus || 'not_paid',
              paymentAmount: person.paymentAmount ? parseFloat(person.paymentAmount) : null,
              eventNotes: person.eventNotes || ''
            });
          }
        });
      }

      if (recipients.length === 0) {
        console.warn("❌ No valid email addresses found for sending notifications");
        return;
      }

      console.log(`📧 Found ${recipients.length} recipients for email notifications with language: ${language}`);

      for (const recipient of recipients) {
        try {
          console.log(`📧 Sending email to ${recipient.email} with individual data:`, {
            paymentStatus: recipient.paymentStatus,
            paymentAmount: recipient.paymentAmount,
            eventNotes: recipient.eventNotes
          });

          const emailResult = await sendEventCreationEmail(
            recipient.email,
            recipient.name,
            businessData.business_name || '',
            eventData.start_date,
            eventData.end_date,
            recipient.paymentStatus,
            recipient.paymentAmount,
            businessData.contact_address || '',
            eventData.id,
            language || 'en',
            recipient.eventNotes
          );

          if (emailResult?.success) {
            console.log(`✅ Event creation email sent successfully to: ${recipient.email} with individual data`);
          } else {
            console.warn(`❌ Failed to send event creation email to ${recipient.email}:`, emailResult?.error);
          }
        } catch (emailError) {
          console.error(`❌ Error sending email to ${recipient.email}:`, emailError);
        }
      }

      if (recipients.length > 0) {
        toast({
          title: "Notifications Sent",
          description: `Booking confirmations sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`
        });
      }
    } catch (error) {
      console.error("❌ Error sending event creation emails:", error);
      toast({
        variant: "destructive",
        title: "Email Error",
        description: "Failed to send booking confirmation emails"
      });
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 EventDialog submit - debugging recurring event logic:', {
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
      console.log('🔄 Showing RecurringEditDialog for event edit choice');
      setShowEditDialog(true);
      return;
    }
    
    // Continue with the actual submission
    await performSubmit();
  };

  const performSubmit = async (forcedChoice?: "this" | "series") => {
    
    const effectiveUserId = getEffectiveUserId();
    const choice = forcedChoice ?? editChoice;
    
    console.log('🔍 Submit debug info:', {
      isPublicMode,
      publicBoardUserId,
      userIdFromAuth: user?.id,
      effectiveUserId,
      isSubUser,
      externalUserName
    });
    
    if (!effectiveUserId) {
      console.error('❌ No effective user ID found');
      toast({
        title: t("common.error"),
        description: isPublicMode ? "Board owner authentication required" : t("common.authRequired"),
        variant: "destructive"
      });
      return;
    }

    // Validate reminder is before event start time
    if (emailReminderEnabled && reminderAt) {
      const reminderTime = new Date(localDateTimeInputToISOString(reminderAt));
      const eventStartTime = new Date(localDateTimeInputToISOString(startDate));
      
      if (reminderTime >= eventStartTime) {
        toast({
          title: t("common.error"),
          description: "Reminder time must be before the event start time",
          variant: "destructive"
        });
        return;
      }
    }

    if (isRecurring) {
      if (!repeatPattern || !repeatUntil) {
        toast({
          title: t("common.error"),
          description: "Please select a repeat pattern and end date for recurring events",
          variant: "destructive"
        });
        return;
      }
      const startDateObj = new Date(localDateTimeInputToISOString(startDate));
      const repeatUntilObj = new Date(repeatUntil);
      if (repeatUntilObj <= startDateObj) {
        toast({
          title: t("common.error"),
          description: "Repeat until date must be after the event start date",
          variant: "destructive"
        });
        return;
      }
    }

    // **ENHANCED: More comprehensive conflict checking for recurring events**
    const newStartTime = new Date(localDateTimeInputToISOString(startDate));
    const newEndTime = new Date(localDateTimeInputToISOString(endDate));

    // Get existing events from React Query cache
    const existingEvents =
      queryClient.getQueryData<CalendarEvent[]>(['events', effectiveUserId]) || [];
    
    // **CRITICAL FIX: Determine all event IDs to exclude from conflict checking**
    let eventIdsToExclude: string[] = [];
    let parentEventId: string | null = null;
    
    // For virtual instances, we need to exclude the entire recurring series
    if (isVirtualEvent && eventId) {
      parentEventId = getParentEventId(eventId);
      eventIdsToExclude.push(parentEventId);
      console.log('🔄 Virtual instance conflict check - excluding parent ID:', parentEventId);
    } else if (initialData?.parent_event_id) {
      parentEventId = initialData.parent_event_id;
      eventIdsToExclude.push(parentEventId);
      console.log('🔄 Child instance conflict check - excluding parent ID:', parentEventId);
    } else if (eventId || initialData?.id) {
      // For regular events or parent recurring events, exclude the event itself
      const currentEventId = eventId || initialData?.id;
      eventIdsToExclude.push(currentEventId);
      parentEventId = currentEventId;
      console.log('🔄 Regular event conflict check - excluding event ID:', currentEventId);
    }

    // **NEW: If this is a recurring event, exclude all instances of the same series**
    if (parentEventId && (isRecurringEvent || initialData?.is_recurring)) {
      // Find all virtual instances that belong to this series
      const seriesInstances = existingEvents.filter(event => {
        // Check if event is a virtual instance of the same parent
        if (isVirtualInstance(event.id)) {
          return getParentEventId(event.id) === parentEventId;
        }
        // Check if event has the same parent_event_id
        return event.parent_event_id === parentEventId || event.id === parentEventId;
      });
      
      seriesInstances.forEach(instance => {
        if (!eventIdsToExclude.includes(instance.id)) {
          eventIdsToExclude.push(instance.id);
        }
      });
      
      console.log('🔄 Recurring series conflict check - excluding all series instances:', eventIdsToExclude);
    }

    console.log('🔍 Enhanced conflict checking details:', {
      eventId,
      initialDataId: initialData?.id,
      eventIdsToExclude,
      isVirtualEvent,
      isRecurringEvent,
      parentEventId,
      newStartTime: newStartTime.toISOString(),
      newEndTime: newEndTime.toISOString()
    });
    
    // Check for conflicts with existing events
    const conflictingEvent = existingEvents.find(event => {
      // Skip checking against any event in the exclusion list
      if (eventIdsToExclude.includes(event.id)) {
        console.log('⏭️ Skipping conflict check with excluded event:', event.id);
        return false;
      }
      
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      
      const hasConflict = timeRangesOverlap(newStartTime, newEndTime, eventStart, eventEnd);
      
      if (hasConflict) {
        console.log('⚠️ Conflict detected with event:', {
          conflictingEventId: event.id,
          conflictingEventTitle: event.title,
          conflictingEventStart: eventStart.toISOString(),
          conflictingEventEnd: eventEnd.toISOString()
        });
      }
      
      return hasConflict;
    });

    if (conflictingEvent) {
      console.log('❌ Time conflict detected, blocking submission');
      toast({
        variant: "destructive",
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "events.timeConflictError"
        }
      });
      return;
    }

    // If creating a recurring event, check all occurrences for conflicts
    if (isRecurring && repeatPattern && repeatUntil) {
      const occurrences = generateRecurringOccurrences(newStartTime, newEndTime, repeatPattern, repeatUntil);
      
      for (const occurrence of occurrences) {
        const conflictingEventInOccurrence = existingEvents.find(event => {
          // Skip checking against any event in the exclusion list
          if (eventIdsToExclude.includes(event.id)) {
            return false;
          }
          
          const eventStart = new Date(event.start_date);
          const eventEnd = new Date(event.end_date);
          
          return timeRangesOverlap(occurrence.start, occurrence.end, eventStart, eventEnd);
        });

        if (conflictingEventInOccurrence) {
          console.log('❌ Recurring event conflict detected, blocking submission');
          toast({
            variant: "destructive",
            translateKeys: {
              titleKey: "common.error",
              descriptionKey: "events.timeConflictError"
            }
          });
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      console.log("🔄 Event creation debug:", {
        isRecurring,
        repeatPattern,
        repeatUntil,
        startDate,
        endDate,
        isNewEvent,
        startDateConverted: localDateTimeInputToISOString(startDate),
        endDateConverted: localDateTimeInputToISOString(endDate),
        reminderAt,
        emailReminderEnabled
      });

      const eventData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: localDateTimeInputToISOString(startDate),
        end_date: localDateTimeInputToISOString(endDate),
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring && repeatPattern ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
        reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
        email_reminder_enabled: emailReminderEnabled,
        // Add sub-user metadata
        ...(isPublicMode && externalUserName ? {
          last_edited_by_type: 'sub_user',
          last_edited_by_name: externalUserName,
          last_edited_by_ai: false
        } : isSubUser ? {
          last_edited_by_type: 'sub_user',
          last_edited_by_name: currentSubUserFullName || user?.email || 'sub_user',
          last_edited_by_ai: false
        } : {
          last_edited_by_ai: false
        })
      };

      console.log("📤 Sending event data to backend with reminder fields:", {
        reminder_at: eventData.reminder_at,
        email_reminder_enabled: eventData.email_reminder_enabled
      });

      let result;
      if (eventId || initialData) {
      // EDIT EXISTING
      if (isRecurringEvent) {
        // Force a choice; do NOT fall back to single-row update
        if (!choice) {
          setShowEditDialog(true);
          setIsLoading(false);
          return;
        }

        if (choice === "series") {
          // series-wide update — preserve dates
          const seriesTargetId = resolveSeriesRootId();

          const seriesEventData = {
            title: userSurname || title || 'Untitled Event',
            user_surname: userSurname,
            user_number: userNumber,
            social_network_link: socialNetworkLink,
            event_notes: eventNotes,
            event_name: eventName,
            payment_status: paymentStatus || 'not_paid',
            payment_amount: paymentAmount || null,
            reminder_at: reminderAt ? localDateTimeInputToISOString(reminderAt) : null,
            email_reminder_enabled: emailReminderEnabled
            // ⚠️ intentionally no start/end here
          };

          const { data: seriesResult, error } = await supabase.rpc('update_event_series_safe', {
            p_event_id: seriesTargetId,
            p_user_id: effectiveUserId,
            p_event_data: seriesEventData,
            p_additional_persons: additionalPersons,
            p_edited_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
            p_edited_by_name: isPublicMode ? externalUserName : isSubUser ? (currentSubUserFullName || user?.email || 'sub_user') : (currentUserProfileName || user?.email || 'admin'),
            p_edited_by_ai: false
          });
          if (error) throw error;
          if (!seriesResult?.success) throw new Error(seriesResult?.error || 'Failed to update series');

          // files go to parent
          if (files.length) {
            await uploadFiles(seriesTargetId);
            setFiles([]);
            await loadExistingFiles(seriesTargetId);
          }

          toast({ title: t("common.success"), description: t("events.eventSeriesUpdated") });
          onEventUpdated?.();
        } else {
          // CRITICAL FIX: Edit only this instance
          // If we're editing an ACTUAL event (not a virtual instance), UPDATE it directly
          // Only create a new standalone event if we're editing a VIRTUAL instance
          
          if (!isVirtualEvent) {
            // This is an actual database event - UPDATE it directly
            const actualEventId = initialData?.id || eventId;
            console.log('🔄 Updating actual event directly:', actualEventId);
            
            const { error: updErr } = await supabase.rpc('save_event_with_persons', {
              p_event_data: eventData, // includes new start/end from inputs
              p_additional_persons: additionalPersons,
              p_user_id: effectiveUserId,
              p_event_id: actualEventId,
              p_created_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
              p_created_by_name: isPublicMode ? externalUserName : isSubUser ? (currentSubUserFullName || user?.email || 'sub_user') : (currentUserProfileName || user?.email || 'admin'),
              p_created_by_ai: false,
              p_last_edited_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
              p_last_edited_by_name: isPublicMode ? externalUserName : isSubUser ? (currentSubUserFullName || user?.email || 'sub_user') : (currentUserProfileName || user?.email || 'admin'),
              p_last_edited_by_ai: false,
            });
            if (updErr) throw updErr;
            
            // Handle file uploads for the updated event
            if (files.length && actualEventId) {
              await uploadFiles(actualEventId);
              setFiles([]);
              await loadExistingFiles(actualEventId);
            }
          } else {
            // This is a VIRTUAL instance -> split it off by creating a standalone event
            console.log('🔄 Splitting virtual instance into standalone event');
            const parentIdForRpc = getParentEventId(eventKey);

            const { data: standaloneResult, error } = await supabase.rpc('edit_single_event_instance_v2', {
              p_event_id: parentIdForRpc,
              p_user_id: effectiveUserId,
              p_event_data: {
                ...eventData, // includes new start_date & end_date from inputs
                language
              },
              // Mark the ORIGINAL occurrence for exclusion
              p_instance_start: originalInstanceStartISO || localDateTimeInputToISOString(startDate),
              p_instance_end: originalInstanceEndISO || localDateTimeInputToISOString(endDate),
              p_additional_persons: additionalPersons,
              p_edited_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
              p_edited_by_name: isPublicMode ? externalUserName : isSubUser ? (currentSubUserFullName || user?.email || 'sub_user') : (currentUserProfileName || user?.email || 'admin'),
              p_edited_by_ai: false
            });
            if (error) throw error;
            if (!standaloneResult?.success) throw new Error(standaloneResult?.error || 'Failed to split instance');

            const newEventId = standaloneResult.new_event_id;
            if (files.length && newEventId) {
              await uploadFiles(newEventId);
              setFiles([]);
              await loadExistingFiles(newEventId);
            }
          }

          toast({ title: t("common.success"), description: t("events.eventUpdated") });
          onEventUpdated?.();
        }

        resetForm();
        onOpenChange(false);
        setEditChoice(null);
        setIsLoading(false);
        return;
      }

      // Non-recurring edit (simple single-row update)
      const actualEventId = eventId || initialData?.id;
      const { error: singleErr } = await supabase.rpc('save_event_with_persons', {
        p_event_data: eventData,
        p_additional_persons: additionalPersons,
        p_user_id: effectiveUserId,
        p_event_id: actualEventId,
        p_created_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
        p_created_by_name: isPublicMode ? externalUserName : isSubUser ? (currentSubUserFullName || user?.email || 'sub_user') : (currentUserProfileName || user?.email || 'admin'),
        p_created_by_ai: false,
        p_last_edited_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
        p_last_edited_by_name: isPublicMode ? externalUserName : isSubUser ? (currentSubUserFullName || user?.email || 'sub_user') : (currentUserProfileName || user?.email || 'admin'),
        p_last_edited_by_ai: false,
      });
      if (singleErr) throw singleErr;

      if (files.length && actualEventId) {
        await uploadFiles(actualEventId);
        setFiles([]);
        await loadExistingFiles(actualEventId);
      }

      toast({ title: t("common.success"), description: t("events.eventUpdated") });
      onEventUpdated?.();
      resetForm();
      onOpenChange(false);
      setEditChoice(null);
      setIsLoading(false);
      return;

        onEventUpdated?.();
      } else {
        console.log('[EventDialog] 📤 Creating new event with data:', {
          eventData,
          additionalPersons,
          effectiveUserId,
          isPublicMode,
          externalUserName,
          isSubUser
        });

        // CRITICAL FIX: Use onSave callback if in public mode, otherwise use direct RPC
        if (isPublicMode && onSave) {
          console.log('[EventDialog] 🎯 Using onSave callback for public mode event creation');
          
          const calendarEventData = {
            ...eventData,
            type: 'event' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id: effectiveUserId
          };
          
          try {
            const createdEvent = await onSave(calendarEventData);
            console.log('[EventDialog] ✅ Event created via onSave callback:', createdEvent);
            
            // CRITICAL FIX: Handle both full event object and ID-only returns
            let eventId: string;
            if (createdEvent && typeof createdEvent === 'object' && 'id' in createdEvent) {
              eventId = (createdEvent as { id: string }).id;
            } else if (typeof createdEvent === 'string') {
              eventId = createdEvent;
            } else {
              throw new Error('Invalid event creation response');
            }
            
            if (files.length > 0 && eventId) {
              await uploadFiles(eventId);
            }
            
            // Skip email sending for public mode sub-users
            console.log('[EventDialog] ℹ️ Skipping email notifications for public mode');
          } catch (error) {
            console.error('[EventDialog] ❌ Error in onSave callback:', error);
            throw error;
          }
          
        } else {
          // Original flow for authenticated users
          result = await supabase.rpc('save_event_with_persons', {
            p_event_data: eventData,
            p_additional_persons: additionalPersons,
            p_user_id: effectiveUserId,
            p_event_id: null,
            p_created_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
            p_created_by_name: isPublicMode ? externalUserName : isSubUser ? (currentSubUserFullName || user?.email || 'sub_user') : (currentUserProfileName || user?.email || 'admin'),
            p_created_by_ai: false,
            p_last_edited_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
            p_last_edited_by_name: isPublicMode ? externalUserName : isSubUser ? (currentSubUserFullName || user?.email || 'sub_user') : (currentUserProfileName || user?.email || 'admin'),
            p_last_edited_by_ai: false,
          });

          if (result.error) throw result.error;

          const newEventId = result.data;
          console.log("✅ Event created with ID:", newEventId);

          if (files.length > 0) {
            await uploadFiles(newEventId);
          }

          if (isRecurring && repeatPattern) {
            console.log("⏳ Waiting for recurring instances to be generated...");
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          await sendEmailToAllPersons({
            ...eventData,
            id: newEventId
          }, additionalPersons);
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
      console.error('Error saving event:', error);
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
      const effectiveUserId = getEffectiveUserId();

      // booking_request special-case stays as-is
      if (initialData?.type === 'booking_request' || initialData?.booking_request_id) {
        await deleteCalendarEvent(
          initialData.id,
          initialData.type === 'booking_request' ? 'booking_request' : 'event',
          user?.id || ''
        );
      } else if (isRecurringEvent) {
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
            user_id: effectiveUserId,
            parent_event_id: parentId,
            excluded_from_series: true,
            created_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
            created_by_name: isPublicMode ? externalUserName : isSubUser ? (user?.email || 'sub_user') : null,
            last_edited_by_type: isPublicMode ? 'sub_user' : isSubUser ? 'sub_user' : 'admin',
            last_edited_by_name: isPublicMode ? externalUserName : isSubUser ? (user?.email || 'sub_user') : null,
          });
        if (exErr) throw exErr;
      } else {
        // Non-recurring: soft-delete the single row
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId || initialData?.id);
        if (error) throw error;
      }

      clearCalendarCache();
      window.dispatchEvent(new CustomEvent('calendar-event-deleted', { detail: { timestamp: Date.now() } }));
      localStorage.setItem('calendar_event_deleted', JSON.stringify({ timestamp: Date.now() }));
      setTimeout(() => localStorage.removeItem('calendar_event_deleted'), 2000);

      toast({ title: t("common.success"), description: t("events.eventDeleted") });
      onEventDeleted?.();
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({ title: t("common.error"), description: error.message || "Failed to delete event", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSeries = async () => {
    if (!eventId && !initialData?.id) return;
    setIsLoading(true);
    try {
      const targetEventId = eventId || initialData?.id;
      const parentId = isVirtualEvent && eventId ? getParentEventId(eventId) : targetEventId;

      const { error } = await supabase.rpc('delete_recurring_series', {
        p_event_id: parentId,
        p_user_id: getEffectiveUserId(),
        p_delete_choice: 'series'
      });

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("events.seriesDeleted")
      });

      onEventDeleted?.();
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting event series:', error);
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
            />
            
            {(initialData || currentEventData) && (
              <div className="px-2 py-1 sm:px-3 sm:py-2 rounded-md border border-border bg-card text-card-foreground w-full max-w-full overflow-hidden mb-4">
                <div className="flex flex-col space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center min-w-0">
                    <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
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
                  <div className="flex items-center min-w-0">
                    <History className="w-3 h-3 mr-1 flex-shrink-0" />
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
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? t("common.loading") : eventId || initialData ? t("common.update") : t("common.add")}
              </Button>
              
              {(eventId || initialData) && (
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
