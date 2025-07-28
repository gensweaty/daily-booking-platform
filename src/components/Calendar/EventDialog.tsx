import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarEventType } from "@/lib/types/calendar";
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

// Helper function to convert ISO string from DB to datetime-local input format
const isoToLocalDateTimeInput = (isoString: string): string => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const EventDialog = ({ 
  open, 
  onOpenChange, 
  selectedDate,
  eventId,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted
}: EventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  
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

  const isNewEvent = !initialData && !eventId;
  const isVirtualEvent = eventId ? isVirtualInstance(eventId) : false;
  const isRecurringEvent = initialData?.is_recurring || isVirtualEvent || isRecurring;

  // FIXED: Load additional persons for existing events - always use parent event ID for recurring events
  const loadAdditionalPersons = async (targetEventId: string) => {
    try {
      // For ANY recurring event (virtual or real child), ALWAYS use the parent event ID
      // This ensures we load additional persons from the parent event where they're stored
      let actualEventId = targetEventId;
      
      // If it's a virtual instance, extract parent ID
      if (isVirtualInstance(targetEventId)) {
        actualEventId = getParentEventId(targetEventId);
        console.log('🔍 Virtual instance detected, using parent ID:', actualEventId);
      } else if (initialData?.parent_event_id) {
        // If it's a real child instance with parent_event_id, use the parent
        actualEventId = initialData.parent_event_id;
        console.log('🔍 Child instance detected, using parent ID:', actualEventId);
      } else if (initialData?.is_recurring && !initialData?.parent_event_id) {
        // If it's the parent event itself, use its own ID
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

  // FIXED: Load existing files for the event - always use parent event ID for recurring events
  const loadExistingFiles = async (targetEventId: string) => {
    try {
      // For ANY recurring event (virtual or real child), ALWAYS use the parent event ID
      // This ensures we load files from the parent event where they're stored
      let actualEventId = targetEventId;
      
      // If it's a virtual instance, extract parent ID
      if (isVirtualInstance(targetEventId)) {
        actualEventId = getParentEventId(targetEventId);
        console.log('📁 Virtual instance detected, using parent ID for files:', actualEventId);
      } else if (initialData?.parent_event_id) {
        // If it's a real child instance with parent_event_id, use the parent
        actualEventId = initialData.parent_event_id;
        console.log('📁 Child instance detected, using parent ID for files:', actualEventId);
      } else if (initialData?.is_recurring && !initialData?.parent_event_id) {
        // If it's the parent event itself, use its own ID
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

  useEffect(() => {
    if (open) {
      if (initialData || eventId) {
        // Load existing files and additional persons
        const targetEventId = eventId || initialData?.id;
        if (targetEventId) {
          loadExistingFiles(targetEventId);
          // Load additional persons for existing events
          loadAdditionalPersons(targetEventId);
        }

        // For virtual instances, we need to load parent event data for recurrence info
        if (isVirtualEvent && eventId) {
          const parentId = getParentEventId(eventId);
          // Load parent event for recurrence settings
          loadParentEventData(parentId);
        }
        
        // Set current event data
        const eventData = initialData;
        if (eventData) {
          setTitle(eventData.title || "");
          setUserSurname(eventData.user_surname || "");  
          setUserNumber(eventData.user_number || "");
          setSocialNetworkLink(eventData.social_network_link || "");
          setEventNotes(eventData.event_notes || "");
          setEventName(eventData.event_name || "");
          setPaymentStatus(eventData.payment_status || "");
          setPaymentAmount(eventData.payment_amount?.toString() || "");
          
          // Handle date synchronization for virtual instances with proper timezone conversion
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
              
              // Use proper timezone conversion
              setStartDate(isoToLocalDateTimeInput(newStart.toISOString()));
              setEndDate(isoToLocalDateTimeInput(newEnd.toISOString()));
            } else {
              // Use proper timezone conversion for regular dates
              setStartDate(isoToLocalDateTimeInput(eventData.start_date));
              setEndDate(isoToLocalDateTimeInput(eventData.end_date));
            }
          } else {
            // Use proper timezone conversion for all date inputs
            setStartDate(isoToLocalDateTimeInput(eventData.start_date));
            setEndDate(isoToLocalDateTimeInput(eventData.end_date));
          }
          
          // Fix: Always load recurrence settings, not just for non-virtual events
          setIsRecurring(eventData.is_recurring || false);
          setRepeatPattern(eventData.repeat_pattern || "");
          setRepeatUntil(eventData.repeat_until || "");
        }
      } else if (selectedDate) {
        // Creating new event - use proper timezone conversion
        const startDateTime = isoToLocalDateTimeInput(selectedDate.toISOString());
        const endDateTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);
        
        setStartDate(startDateTime);
        setEndDate(isoToLocalDateTimeInput(endDateTime.toISOString()));
        
        // Reset additional persons for new event
        setAdditionalPersons([]);
        // Reset all other fields for new event
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
      }
    }
  }, [open, selectedDate, initialData, eventId, isVirtualEvent]);

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
    setAdditionalPersons([]);
    setFiles([]);
    setExistingFiles([]);
  };

  const uploadFiles = async (eventId: string) => {
    if (files.length === 0) return;

    const uploadPromises = files.map(async (file) => {
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
  };

  // FIXED: Enhanced email sending function that sends individual payment status and notes for each person
  const sendEmailToAllPersons = async (eventData: any, additionalPersons: any[] = []) => {
    try {
      console.log(`🔔 Starting email notification process for event: ${eventData.title || eventData.user_surname}`);
      
      // Get user's business profile for the email
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (!businessData) {
        console.warn("❌ Missing business data for event notification - skipping email");
        return;
      }

      // Collect all recipients with their individual data
      const recipients: Array<{ 
        email: string; 
        name: string; 
        paymentStatus: string;
        paymentAmount: number | null;
        eventNotes: string;
      }> = [];
      
      // Add main customer if they have a valid email with their individual data
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
      
      // Add additional persons with valid emails and their individual data
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
      
      // Send emails to all recipients with their individual payment status and notes
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
            recipient.paymentStatus, // Use individual payment status
            recipient.paymentAmount, // Use individual payment amount
            businessData.contact_address || '',
            eventData.id,
            language || 'en', // Use current UI language
            recipient.eventNotes // Use individual event notes
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
      
      // Show success toast
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

  // Helper function to validate email format
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

    // Fix: Validate recurring event data for BOTH new and existing events
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

    setIsLoading(true);

    try {
      // Enhanced debug logging for repeat pattern
      console.log("🔄 Event creation debug:", {
        isRecurring,
        repeatPattern,
        repeatUntil,
        startDate,
        endDate,
        isNewEvent,
        startDateConverted: localDateTimeToISOString(startDate),
        endDateConverted: localDateTimeToISOString(endDate)
      });

      const eventData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName,
        start_date: localDateTimeToISOString(startDate), // Convert to proper ISO string
        end_date: localDateTimeToISOString(endDate), // Convert to proper ISO string
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        // Fix: Always send recurring data if it's set, regardless of isNewEvent
        is_recurring: isRecurring,
        repeat_pattern: (isRecurring && repeatPattern) ? repeatPattern : null,
        repeat_until: (isRecurring && repeatUntil) ? repeatUntil : null,
      };

      console.log("📤 Sending event data to backend:", eventData);

      let result;
      
      if (eventId || initialData) {
        // FIXED: Update existing event - for virtual instances AND child instances, update the parent event
        let actualEventId = eventId || initialData?.id;
        
        if (isVirtualEvent && eventId) {
          // Virtual instance - update parent
          actualEventId = getParentEventId(eventId);
          console.log('🔄 Virtual instance update - using parent ID:', actualEventId);
        } else if (initialData?.parent_event_id) {
          // Real child instance - update parent
          actualEventId = initialData.parent_event_id;
          console.log('🔄 Child instance update - using parent ID:', actualEventId);
        }
        
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: eventData,
            p_additional_persons: additionalPersons,
            p_user_id: user.id,
            p_event_id: actualEventId
          });
          
        if (result.error) throw result.error;
        
        toast({
          title: t("common.success"),
          description: t("events.eventUpdated")
        });
        
        // Send emails to all persons for updated event with individual data
        await sendEmailToAllPersons({
          ...eventData,
          id: actualEventId
        }, additionalPersons);
        
        onEventUpdated?.();
      } else {
        // Create new event
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: eventData,
            p_additional_persons: additionalPersons,
            p_user_id: user.id
          });

        if (result.error) throw result.error;

        const newEventId = result.data;
        
        console.log("✅ Event created with ID:", newEventId);
        
        // Upload files for new event
        if (files.length > 0) {
          await uploadFiles(newEventId);
        }

        // Wait a bit for recurring events to be generated
        if (isRecurring && repeatPattern) {
          console.log("⏳ Waiting for recurring instances to be generated...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Send emails to all persons for new event with individual data
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
      // Determine if this is an approved booking request or an event linked to one
      if (initialData?.type === 'booking_request' || initialData?.booking_request_id) {
        // Use unified deletion to remove booking_request and any linked events
        await deleteCalendarEvent(
          initialData.id,
          initialData.type === 'booking_request' ? 'booking_request' : 'event',
          user?.id || ''
        );
      } else {
        // Normal event deletion (soft-delete the event record)
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId || initialData?.id);
          
        if (error) throw error;
        
        // Clear cache and broadcast, so all views are updated immediately
        clearCalendarCache();
        window.dispatchEvent(new CustomEvent('calendar-event-deleted', { detail: { timestamp: Date.now() } }));
        localStorage.setItem('calendar_event_deleted', JSON.stringify({ timestamp: Date.now() }));
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
      
      // Use the delete_recurring_series function
      const { error } = await supabase
        .rpc('delete_recurring_series', {
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
              {eventId || initialData 
                ? t("events.editEvent") 
                : language === 'ka' 
                  ? "მოვლენის დამატება" 
                  : t("events.addEvent")
              }
            </DialogTitle>
          </DialogHeader>
          
          {/* Created/Updated metadata section - only show for existing events */}
          {initialData && (
            <div className="flex items-center text-sm text-muted-foreground mb-4">
              <span className="flex items-center mr-4">
                <Clock className="mr-1 h-4 w-4" />
                <span>{t("tasks.createdAt")}: {new Date(initialData.created_at).toLocaleString(language)}</span>
              </span>
              <span className="flex items-center">
                <RefreshCcw className="mr-1 h-4 w-4" />
                <span>{t("tasks.lastUpdated")}: {new Date(initialData.created_at).toLocaleString(language)}</span>
              </span>
            </div>
          )}
          
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
              setPaymentStatus={setPaymentStatus}
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
            />
            
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? t("common.loading") : (eventId || initialData ? t("common.update") : t("common.add"))}
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
