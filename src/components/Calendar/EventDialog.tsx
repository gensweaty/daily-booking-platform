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

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  eventId?: string;
  initialData?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

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

  // Load additional persons for existing events
  const loadAdditionalPersons = async (targetEventId: string) => {
    try {
      // CRITICAL FIX: Always use parent event ID for virtual instances
      // This ensures all recurring instances show the same additional persons
      const actualEventId = isVirtualInstance(targetEventId) ? getParentEventId(targetEventId) : targetEventId;
      
      console.log('🔍 Loading additional persons:', {
        targetEventId,
        actualEventId,
        isVirtualInstance: isVirtualInstance(targetEventId),
        eventId
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
      setAdditionalPersons([]);
    }
  };

  // Load existing files for the event
  const loadExistingFiles = async (targetEventId: string) => {
    try {
      // CRITICAL FIX: Always use parent event ID for virtual instances
      // This ensures all recurring instances show the same files
      const actualEventId = isVirtualInstance(targetEventId) ? getParentEventId(targetEventId) : targetEventId;
      
      console.log('📁 Loading existing files:', {
        targetEventId,
        actualEventId,
        isVirtualInstance: isVirtualInstance(targetEventId),
        eventId
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
      setExistingFiles([]);
    }
  };

  // Load parent event data for virtual instances
  const loadParentEventData = async (parentId: string) => {
    try {
      console.log('📊 Loading parent event data for ID:', parentId);
      
      const { data: parentEvent, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', parentId)
        .single();

      if (error) {
        console.error('Error loading parent event:', error);
        return null;
      }

      console.log('✅ Loaded parent event data:', parentEvent);
      return parentEvent;
    } catch (error) {
      console.error('Error loading parent event:', error);
      return null;
    }
  };

  useEffect(() => {
    if (open) {
      if (initialData || eventId) {
        // Determine the target event ID and whether it's virtual
        const targetEventId = eventId || initialData?.id;
        const isTargetVirtual = targetEventId ? isVirtualInstance(targetEventId) : false;
        
        console.log('🔄 EventDialog useEffect - Loading event data:', {
          targetEventId,
          isTargetVirtual,
          eventId,
          initialData: !!initialData
        });
        
        if (targetEventId) {
          // Always load additional persons and files (using parent ID for virtual instances)
          loadExistingFiles(targetEventId);
          loadAdditionalPersons(targetEventId);
        }

        // Handle form data initialization
        if (isTargetVirtual && eventId) {
          // For virtual instances, we need to load parent event data for form fields
          // but use the virtual instance date
          const parentId = getParentEventId(eventId);
          const instanceDate = getInstanceDate(eventId);
          
          console.log('🔍 Virtual instance detected:', {
            virtualId: eventId,
            parentId,
            instanceDate
          });
          
          // Load parent event data for form initialization
          loadParentEventData(parentId).then(parentData => {
            if (parentData && instanceDate) {
              // Set form fields from parent event
              setTitle(parentData.title || "");
              setUserSurname(parentData.user_surname || "");  
              setUserNumber(parentData.user_number || "");
              setSocialNetworkLink(parentData.social_network_link || "");
              setEventNotes(parentData.event_notes || "");
              setEventName(parentData.event_name || "");
              setPaymentStatus(parentData.payment_status || "");
              setPaymentAmount(parentData.payment_amount?.toString() || "");
              
              // Set recurrence info from parent
              setIsRecurring(parentData.is_recurring || false);
              setRepeatPattern(parentData.repeat_pattern || "");
              setRepeatUntil(parentData.repeat_until || "");
              
              // Calculate instance-specific dates
              const baseStart = new Date(parentData.start_date);
              const baseEnd = new Date(parentData.end_date);
              
              const [year, month, day] = instanceDate.split('-');
              const newStart = new Date(baseStart);
              newStart.setFullYear(+year, +month - 1, +day);
              const newEnd = new Date(baseEnd);
              newEnd.setFullYear(+year, +month - 1, +day);
              
              setStartDate(isoToLocalDateTimeInput(newStart.toISOString()));
              setEndDate(isoToLocalDateTimeInput(newEnd.toISOString()));
              
              console.log('✅ Virtual instance form initialized with parent data');
            }
          });
          
        } else if (initialData) {
          // Regular event data initialization
          setTitle(initialData.title || "");
          setUserSurname(initialData.user_surname || "");  
          setUserNumber(initialData.user_number || "");
          setSocialNetworkLink(initialData.social_network_link || "");
          setEventNotes(initialData.event_notes || "");
          setEventName(initialData.event_name || "");
          setPaymentStatus(initialData.payment_status || "");
          setPaymentAmount(initialData.payment_amount?.toString() || "");
          
          // Use proper timezone conversion for all date inputs
          setStartDate(isoToLocalDateTimeInput(initialData.start_date));
          setEndDate(isoToLocalDateTimeInput(initialData.end_date));
          
          // Set recurrence settings
          setIsRecurring(initialData.is_recurring || false);
          setRepeatPattern(initialData.repeat_pattern || "");
          setRepeatUntil(initialData.repeat_until || "");
          
          console.log('✅ Regular event form initialized');
        }
      } else if (selectedDate) {
        // Creating new event - reset all fields
        const startDateTime = isoToLocalDateTimeInput(selectedDate.toISOString());
        const endDateTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);
        
        setStartDate(startDateTime);
        setEndDate(isoToLocalDateTimeInput(endDateTime.toISOString()));
        
        // Reset all fields for new event
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
        setAdditionalPersons([]);
        
        console.log('✅ New event form initialized');
      }
    }
  }, [open, selectedDate, initialData, eventId, isVirtualEvent]);

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

      // Collect all recipients (main customer + additional persons)
      const recipients: Array<{ email: string; name: string }> = [];
      
      // Add main customer if they have a valid email
      const mainCustomerEmail = eventData.social_network_link;
      if (mainCustomerEmail && isValidEmail(mainCustomerEmail)) {
        recipients.push({
          email: mainCustomerEmail,
          name: eventData.title || eventData.user_surname || ''
        });
      }
      
      // Add additional persons with valid emails
      if (additionalPersons && additionalPersons.length > 0) {
        additionalPersons.forEach(person => {
          if (person.socialNetworkLink && isValidEmail(person.socialNetworkLink)) {
            recipients.push({
              email: person.socialNetworkLink,
              name: person.userSurname || ''
            });
          }
        });
      }
      
      if (recipients.length === 0) {
        console.warn("❌ No valid email addresses found for sending notifications");
        return;
      }
      
      console.log(`📧 Found ${recipients.length} recipients for email notifications with language: ${language}`);
      
      // Send emails to all recipients with proper language
      for (const recipient of recipients) {
        try {
          const emailResult = await sendEventCreationEmail(
            recipient.email,
            recipient.name,
            businessData.business_name || '',
            eventData.start_date,
            eventData.end_date,
            eventData.payment_status || 'not_paid',
            eventData.payment_amount || null,
            businessData.contact_address || '',
            eventData.id,
            language || 'en', // Use current UI language
            eventData.event_notes || ''
          );
          
          if (emailResult?.success) {
            console.log(`✅ Event creation email sent successfully to: ${recipient.email}`);
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
        // CRITICAL FIX: For virtual instances, always update the parent event
        const actualEventId = (isVirtualEvent && eventId) ? getParentEventId(eventId) : (eventId || initialData?.id);
        
        console.log('🔄 Updating event:', {
          originalEventId: eventId || initialData?.id,
          actualEventId,
          isVirtualEvent
        });
        
        result = await supabase
          .rpc('save_event_with_persons', {
            p_event_data: eventData,
            p_additional_persons: additionalPersons,
            p_user_id: user.id,
            p_event_id: actualEventId
          });
          
        if (result.error) throw result.error;
        
        toast({
          title: t("events.eventUpdated"),
          description: t("events.eventUpdatedDescription")
        });
        
        // Send emails to all persons for updated event
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

        // Send emails to all persons for new event
        await sendEmailToAllPersons({
          ...eventData,
          id: newEventId
        }, additionalPersons);

        if (isRecurring) {
          toast({
            title: t("events.recurringEventCreated"),
            description: t("events.recurringEventCreatedDescription")
          });
        } else {
          toast({
            title: t("events.eventCreated"),
            description: t("events.eventCreatedDescription")
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
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId || initialData?.id);
        
      if (error) throw error;
      
      toast({
        title: t("events.eventDeleted"),
        description: t("events.eventDeletedDescription")
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
        title: t("events.eventSeriesDeleted"),
        description: t("events.eventSeriesDeletedDescription")
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {eventId || initialData ? t("events.editEvent") : t("events.addNewEvent")}
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
              additionalPersons={additionalPersons.map(person => ({
                ...person,
                id: person.id || crypto.randomUUID()
              }))}
              setAdditionalPersons={setAdditionalPersons}
              isNewEvent={isNewEvent}
            />

            <div className="flex justify-between">
              <div className="flex gap-2">
                {(eventId || initialData) && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isLoading}
                  >
                    {t("events.deleteEvent")}
                  </Button>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? t("common.loading") : eventId || initialData ? t("events.updateEvent") : t("events.createEvent")}
                </Button>
              </div>
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
      />
    </>
  );
};
