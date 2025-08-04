import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarEvent } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EventDialogFields } from "./EventDialogFields";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { sendEventCreationEmail } from "@/lib/api";
import { isVirtualInstance, getParentEventId, getInstanceDate } from "@/lib/recurringEvents";
import { deleteCalendarEvent, clearCalendarCache } from "@/services/calendarService";
import { Clock, RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  eventId?: string;
  initialData?: CalendarEvent;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onSave?: (data: any) => void;
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

// Helper function to convert datetime-local input values to ISO string in local timezone
const localDateTimeToISOString = (dtStr: string): string => {
  if (!dtStr) return new Date().toISOString();
  const [datePart, timePart] = dtStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  // Create date in local timezone
  const localDate = new Date(year, month - 1, day, hour, minute);
  return localDate.toISOString();
};

// CRITICAL FIX: Enhanced helper function to convert ISO string to datetime-local input format
const isoToLocalDateTimeInput = (isoString: string): string => {
  console.log('🔍 Converting ISO string to datetime-local input:', isoString);
  
  if (!isoString || 
      isoString === 'null' || 
      isoString === '' || 
      isoString === 'undefined' ||
      isoString === null ||
      isoString === undefined) {
    console.log('❌ Invalid ISO string provided:', isoString);
    return '';
  }
  
  try {
    const date = new Date(isoString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date created from ISO string:', isoString);
      return '';
    }
    
    const pad = (n: number) => String(n).padStart(2, '0');
    const result = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    
    console.log('✅ Successfully converted ISO to datetime-local:', { input: isoString, output: result });
    return result;
  } catch (error) {
    console.error('❌ Error converting ISO date to input format:', error, 'Input:', isoString);
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
  isOpen = false,
  onClose = () => {},
  onSave = () => {}
}: EventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  
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
  const [currentEventData, setCurrentEventData] = useState<CalendarEvent | null>(null);
  const [reminderAt, setReminderAt] = useState("");
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);

  const isNewEvent = !initialData && !eventId;
  const isVirtualEvent = eventId ? isVirtualInstance(eventId) : false;
  const isRecurringEvent = initialData?.is_recurring || isVirtualEvent || isRecurring;

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

      const { data: eventFiles, error } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', actualEventId);

      if (error) {
        console.error('Error loading event files:', error);
        return;
      }

      console.log('✅ Loaded existing files:', eventFiles?.length || 0, 'files for actualEventId:', actualEventId);
      setExistingFiles(eventFiles || []);
    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  };

  const loadEventData = async (targetEventId: string) => {
    try {
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', targetEventId)
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
  useEffect(() => {
    console.log('🔧 EventDialog useEffect triggered:', { 
      open, 
      eventId, 
      initialDataId: initialData?.id,
      hasInitialData: !!initialData 
    });

    if (open) {
      if (initialData || eventId) {
        const targetEventId = eventId || initialData?.id;
        if (targetEventId) {
          console.log('📋 Loading data for event:', targetEventId);
          loadEventData(targetEventId);
          loadExistingFiles(targetEventId);
          loadAdditionalPersons(targetEventId);
        }

        if (isVirtualEvent && eventId) {
          const parentId = getParentEventId(eventId);
          loadParentEventData(parentId);
        }

        const eventData = initialData;
        if (eventData) {
          console.log('🔧 Initializing form with event data:', {
            id: eventData.id,
            title: eventData.title,
            reminderAt: eventData.reminder_at,
            emailReminderEnabled: eventData.email_reminder_enabled,
            reminderAtType: typeof eventData.reminder_at,
            emailReminderType: typeof eventData.email_reminder_enabled
          });
          
          setTitle(eventData.title || "");
          setUserSurname(eventData.user_surname || "");
          setUserNumber(eventData.user_number || "");
          setSocialNetworkLink(eventData.social_network_link || "");
          setEventNotes(eventData.event_notes || "");
          setEventName(eventData.event_name || "");
          setPaymentStatus(eventData.payment_status || "");
          setPaymentAmount(eventData.payment_amount?.toString() || "");

          if (isVirtualEvent && eventId) {
            const instanceDate = getInstanceDate(eventId);
            if (instanceDate && eventData) {
              const baseStart = new Date(eventData.start_date);
              const baseEnd = new Date(eventData.end_date);
              const [year, month, day] = instanceDate.split('-');
              const newStart = new Date(baseStart);
              newStart.setFullYear(+year, +month - 1, +day);
              const newEnd = new Date(baseEnd);
              newEnd.setFullYear(+year, +month - 1, +day);

              setStartDate(isoToLocalDateTimeInput(newStart.toISOString()));
              setEndDate(isoToLocalDateTimeInput(newEnd.toISOString()));
            } else {
              setStartDate(isoToLocalDateTimeInput(eventData.start_date));
              setEndDate(isoToLocalDateTimeInput(eventData.end_date));
            }
          } else {
            setStartDate(isoToLocalDateTimeInput(eventData.start_date));
            setEndDate(isoToLocalDateTimeInput(eventData.end_date));
          }

          setIsRecurring(eventData.is_recurring || false);
          setRepeatPattern(eventData.repeat_pattern || "");
          setRepeatUntil(eventData.repeat_until || "");
          
          // CRITICAL FIX: Properly load and set reminder fields with comprehensive validation
          const reminderValue = eventData.reminder_at;
          console.log('📅 Processing reminder_at value:', {
            rawValue: reminderValue,
            type: typeof reminderValue,
            isNull: reminderValue === null,
            isUndefined: reminderValue === undefined,
            isEmpty: reminderValue === '',
            isStringNull: reminderValue === 'null',
            isStringUndefined: reminderValue === 'undefined'
          });
          
          if (reminderValue && 
              reminderValue !== null && 
              reminderValue !== 'null' && 
              reminderValue !== undefined && 
              reminderValue !== 'undefined' &&
              String(reminderValue).trim() !== '') {
            
            const convertedReminder = isoToLocalDateTimeInput(String(reminderValue));
            console.log('📅 Setting reminderAt:', { original: reminderValue, converted: convertedReminder });
            setReminderAt(convertedReminder);
          } else {
            console.log('📅 No valid reminder_at found, setting to empty');
            setReminderAt("");
          }
          
          // CRITICAL FIX: Properly handle boolean email reminder field
          const emailReminderValue = eventData.email_reminder_enabled;
          const emailReminderBoolean = Boolean(emailReminderValue);
          console.log('📧 Setting email reminder:', {
            rawValue: emailReminderValue,
            convertedValue: emailReminderBoolean,
            type: typeof emailReminderValue
          });
          setEmailReminderEnabled(emailReminderBoolean);
        }
      } else if (selectedDate) {
        const startDateTime = isoToLocalDateTimeInput(selectedDate.toISOString());
        const endDateTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);
        setStartDate(startDateTime);
        setEndDate(isoToLocalDateTimeInput(endDateTime.toISOString()));

        // Reset reminder fields for new event
        setReminderAt("");
        setEmailReminderEnabled(false);
        console.log('🔄 New event: Reset reminder fields');
      }
    }
  }, [open, selectedDate, initialData, eventId, isVirtualEvent]);

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
    if (files.length === 0) return;
    
    console.log('📤 Uploading', files.length, 'files for event:', eventId);
    
    const uploadPromises = files.map(async file => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('event_attachments')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return null;
      }

      const { error: dbError } = await supabase
        .from('event_files')
        .insert({
          filename: file.name,
          file_path: fileName,
          content_type: file.type,
          size: file.size,
          user_id: user?.id,
          event_id: eventId
        });

      if (dbError) {
        console.error('Error saving file record:', dbError);
        return null;
      }

      return fileName;
    });

    await Promise.all(uploadPromises);
    console.log('✅ Files uploaded successfully');
  };

  const sendEmailToAllPersons = async (eventData: any, additionalPersons: any[] = []) => {
    try {
      console.log(`🔔 Starting email notification process for event: ${eventData.title || eventData.user_surname}`);

      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user?.id)
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
    if (!user) {
      toast({
        title: t("common.error"),
        description: t("common.authRequired")
      });
      return;
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
      const startDateObj = new Date(localDateTimeToISOString(startDate));
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
    const newStartTime = new Date(localDateTimeToISOString(startDate));
    const newEndTime = new Date(localDateTimeToISOString(endDate));

    // Get existing events from React Query cache
    const existingEvents = queryClient.getQueryData<CalendarEvent[]>(['events', user.id]) || [];
    
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
      console.log("🔄 Event creation/update with reminder data:", {
        reminderAt,
        emailReminderEnabled,
        reminderAtConverted: reminderAt ? localDateTimeToISOString(reminderAt) : null
      });

      const eventData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: localDateTimeToISOString(startDate),
        end_date: localDateTimeToISOString(endDate),
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        is_recurring: isRecurring,
        repeat_pattern: isRecurring && repeatPattern ? repeatPattern : null,
        repeat_until: isRecurring && repeatUntil ? repeatUntil : null,
        reminder_at: reminderAt ? localDateTimeToISOString(reminderAt) : null,
        email_reminder_enabled: emailReminderEnabled
      };

      console.log("📤 Sending event data with reminder fields:", {
        reminder_at: eventData.reminder_at,
        email_reminder_enabled: eventData.email_reminder_enabled
      });

      let result;
      if (eventId || initialData) {
        let actualEventId = eventId || initialData?.id;
        if (isVirtualEvent && eventId) {
          actualEventId = getParentEventId(eventId);
          console.log('🔄 Virtual instance update - using parent ID:', actualEventId);
        } else if (initialData?.parent_event_id) {
          actualEventId = initialData.parent_event_id;
          console.log('🔄 Child instance update - using parent ID:', actualEventId);
        }

        result = await supabase.rpc('save_event_with_persons', {
          p_event_data: eventData,
          p_additional_persons: additionalPersons,
          p_user_id: user.id,
          p_event_id: actualEventId
        });

        if (result.error) throw result.error;

        // Upload files after successful event update
        if (files.length > 0) {
          try {
            await uploadFiles(actualEventId);
            console.log('✅ Files uploaded successfully after event update');
            
            // Clear files state after successful upload
            setFiles([]);
            
            // Refresh the existing files list to show newly uploaded files
            await loadExistingFiles(actualEventId);
          } catch (fileError) {
            console.error('❌ Error uploading files during event update:', fileError);
            toast({
              title: t("common.warning"),
              description: "Event updated successfully, but some files failed to upload",
              variant: "destructive"
            });
          }
        }

        if (actualEventId) {
          const freshEventData = await loadEventData(actualEventId);
          if (freshEventData) {
            setCurrentEventData(freshEventData);
          }
        }

        toast({
          title: t("common.success"),
          description: t("events.eventUpdated")
        });

        await sendEmailToAllPersons({
          ...eventData,
          id: actualEventId
        }, additionalPersons);

        onEventUpdated?.();
      } else {
        result = await supabase.rpc('save_event_with_persons', {
          p_event_data: eventData,
          p_additional_persons: additionalPersons,
          p_user_id: user.id
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

  const handleDeleteThis = async () => {
    if (!eventId && !initialData?.id) return;
    setIsLoading(true);
    try {
      if (initialData?.type === 'booking_request' || initialData?.booking_request_id) {
        await deleteCalendarEvent(initialData.id, initialData.type === 'booking_request' ? 'booking_request' : 'event', user?.id || '');
      } else {
        const { error } = await supabase
          .from('events')
          .update({
            deleted_at: new Date().toISOString()
          })
          .eq('id', eventId || initialData?.id);

        if (error) throw error;

        clearCalendarCache();
        window.dispatchEvent(new CustomEvent('calendar-event-deleted', {
          detail: { timestamp: Date.now() }
        }));
        localStorage.setItem('calendar_event_deleted', JSON.stringify({
          timestamp: Date.now()
        }));
        setTimeout(() => localStorage.removeItem('calendar_event_deleted'), 2000);
      }

      toast({
        title: t("common.success"),
        description: t("events.eventDeleted")
      });

      onEventDeleted?.();
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting event:', error);
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
      const targetEventId = eventId || initialData?.id;
      const parentId = isVirtualEvent && eventId ? getParentEventId(eventId) : targetEventId;

      const { error } = await supabase.rpc('delete_recurring_series', {
        p_event_id: parentId,
        p_user_id: user?.id,
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
              <div className="flex items-center text-sm text-muted-foreground mb-4 rounded-md p-4 py-[8px] px-[8px] border border-border bg-card">
                <span className="flex items-center mr-4">
                  <Clock className="mr-1 h-4 w-4" />
                  <span>
                    {t("common.created")} {new Date((currentEventData || initialData)?.created_at || '').toLocaleString(language)}
                  </span>
                </span>
                <span className="flex items-center">
                  <RefreshCcw className="mr-1 h-4 w-4" />
                  <span>
                    {t("common.lastUpdated")} {new Date((currentEventData || initialData)?.updated_at || (currentEventData || initialData)?.created_at || '').toLocaleString(language)}
                  </span>
                </span>
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
    </>
  );
};
