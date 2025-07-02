import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EventDialogFields } from "./EventDialogFields";
import { useLanguage } from "@/contexts/LanguageContext";
import { sendBookingConfirmationEmail, sendBookingConfirmationToMultipleRecipients } from "@/lib/api";
import { CalendarEvent } from "@/lib/types";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  selectedDate?: Date;
  onSave?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

export const EventDialog = ({ 
  open, 
  onOpenChange, 
  event, 
  selectedDate: propSelectedDate,
  onSave, 
  onDelete,
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
  const [startDate, setStartDate] = useState<Date>(propSelectedDate || new Date());
  const [endDate, setEndDate] = useState<Date>(propSelectedDate || new Date());
  const [paymentStatus, setPaymentStatus] = useState<string>("not_paid");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [eventNotes, setEventNotes] = useState<string>("");
  const [additionalPersons, setAdditionalPersons] = useState<
    { title: string; userSurname: string; socialNetworkLink: string }[]
  >([]);

  useEffect(() => {
    if (event) {
      setTitle(event.title || "");
      setUserSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setStartDate(new Date(event.start_date) || new Date());
      setEndDate(new Date(event.end_date) || new Date());
      setPaymentStatus(event.payment_status || "not_paid");
      setPaymentAmount(event.payment_amount?.toString() || "");
      setEventNotes(event.event_notes || "");

      // Load additional persons from event details
      if (event.additional_persons && typeof event.additional_persons === 'string') {
        try {
          setAdditionalPersons(JSON.parse(event.additional_persons));
        } catch (error) {
          console.error("Error parsing additional persons:", error);
          setAdditionalPersons([]);
        }
      } else if (Array.isArray(event.additional_persons)) {
        // If it's already an array, use it directly
        setAdditionalPersons(event.additional_persons);
      } else {
        setAdditionalPersons([]);
      }
    } else {
      // Reset form fields when creating a new event
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setStartDate(propSelectedDate || new Date());
      setEndDate(propSelectedDate || new Date());
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setEventNotes("");
      setAdditionalPersons([]);
    }
  }, [event, propSelectedDate]);

  const handleAddPerson = () => {
    setAdditionalPersons([
      ...additionalPersons,
      { title: "", userSurname: "", socialNetworkLink: "" },
    ]);
  };

  const handlePersonChange = (
    index: number,
    field: string,
    value: string
  ) => {
    const updatedPersons = [...additionalPersons];
    updatedPersons[index][field] = value;
    setAdditionalPersons(updatedPersons);
  };

  const handleRemovePerson = (index: number) => {
    const updatedPersons = [...additionalPersons];
    updatedPersons.splice(index, 1);
    setAdditionalPersons(updatedPersons);
  };

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Enhanced helper function to send email notifications for new events
  const sendEventCreationEmail = async (eventData: any, additionalPersons: any[] = []) => {
    try {
      console.log(`🔔 Starting email notification process for event: ${eventData.title || eventData.user_surname}`);
      
      // Get user's business profile for the email
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      console.log("📊 Business data for email:", businessData);
      
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
              name: person.userSurname || person.title || ''
            });
          }
        });
      }
      
      if (recipients.length === 0) {
        console.warn("❌ No valid email addresses found for sending notifications");
        return;
      }
      
      console.log(`📧 Found ${recipients.length} recipients for email notifications`);
      
      // Send emails to all recipients with 'event-creation' source
      if (recipients.length === 1) {
        // Single recipient - use the direct email function
        const emailResult = await sendBookingConfirmationEmail(
          recipients[0].email,
          recipients[0].name,
          businessData.business_name || '',
          eventData.start_date,
          eventData.end_date,
          eventData.payment_status || 'not_paid',
          eventData.payment_amount || null,
          businessData.contact_address || '',
          eventData.id,
          language || 'en',
          eventData.event_notes || '',
          'event-creation'
        );
        
        console.log("📧 Single email result:", emailResult);
        
        if (emailResult?.success) {
          console.log(`✅ Event creation email sent successfully to: ${recipients[0].email}`);
          toast({
            title: "Notification Sent",
            description: `Booking confirmation sent to ${recipients[0].email}`
          });
        } else {
          console.warn(`❌ Failed to send event creation email to ${recipients[0].email}:`, emailResult.error);
          toast({
            variant: "destructive",
            title: "Email Failed",
            description: `Failed to send confirmation to ${recipients[0].email}`
          });
        }
      } else {
        // Multiple recipients - use the batch email function
        const emailResults = await sendBookingConfirmationToMultipleRecipients(
          recipients,
          businessData.business_name || '',
          eventData.start_date,
          eventData.end_date,
          eventData.payment_status || 'not_paid',
          eventData.payment_amount || null,
          businessData.contact_address || '',
          eventData.id,
          language || 'en',
          eventData.event_notes || '',
          'event-creation'
        );
        
        console.log("📧 Multiple email results:", emailResults);
        
        if (emailResults.successful > 0) {
          console.log(`✅ Successfully sent ${emailResults.successful}/${emailResults.total} event creation emails`);
          toast({
            title: "Notifications Sent",
            description: `Booking confirmations sent to ${emailResults.successful} of ${emailResults.total} recipients`
          });
        }
        
        if (emailResults.failed > 0) {
          console.warn(`❌ Failed to send ${emailResults.failed}/${emailResults.total} event creation emails`);
          toast({
            variant: "destructive",
            title: "Some Emails Failed",
            description: `${emailResults.failed} email notifications failed to send`
          });
        }
      }
    } catch (error) {
      console.error("❌ Error sending event creation email:", error);
      toast({
        variant: "destructive",
        title: "Email Error",
        description: "Failed to send booking confirmation emails"
      });
      // Don't throw - we don't want to break the main flow if just the email fails
    }
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!user?.id) {
        toast({
          title: t("common.error"),
          description: t("common.missingUserInfo"),
          variant: "destructive",
        });
        return;
      }

      const eventData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        event_notes: eventNotes,
        user_id: user.id,
        additional_persons: JSON.stringify(additionalPersons),
      };

      try {
        if (event) {
          // Update existing event
          const { data, error } = await supabase
            .from("events")
            .update(eventData)
            .eq("id", event.id)
            .eq("user_id", user.id)
            .select()
            .single();

          if (error) {
            console.error("Error updating event:", error);
            toast({
              title: t("common.error"),
              description: t("crm.eventUpdateFailed"),
              variant: "destructive",
            });
          } else {
            // Send email notification for the updated event
            await sendEventCreationEmail({
              ...data,
              event_notes: eventNotes // Ensure notes are included
            }, additionalPersons);
            
            toast({
              title: t("common.success"),
              description: t("crm.eventUpdated"),
            });
            onSave?.(data);
            onEventUpdated?.();
            onOpenChange(false);
          }
        } else {
          // Create new event
          const { data, error } = await supabase
            .from("events")
            .insert(eventData)
            .select()
            .single();

          if (error) {
            console.error("Error creating event:", error);
            toast({
              title: t("common.error"),
              description: t("crm.eventCreationFailed"),
              variant: "destructive",
            });
          } else {
            // Send email notification for the newly created event
            await sendEventCreationEmail({
              ...data,
              event_notes: eventNotes // Ensure notes are included
            }, additionalPersons);
            
            toast({
              title: t("common.success"),
              description: t("crm.eventCreated"),
            });
            onSave?.(data);
            onEventCreated?.();
            onOpenChange(false);
          }
        }
      } catch (error: any) {
        console.error("Error submitting event:", error);
        toast({
          title: t("common.error"),
          description: error.message || t("common.errorOccurred"),
          variant: "destructive",
        });
      }
    },
    [
      title,
      userSurname,
      userNumber,
      socialNetworkLink,
      startDate,
      endDate,
      paymentStatus,
      paymentAmount,
      eventNotes,
      user?.id,
      additionalPersons,
      event,
      supabase,
      toast,
      t,
      onSave,
      onEventCreated,
      onEventUpdated,
      onOpenChange,
      language
    ]
  );

  const handleDelete = async () => {
    if (!event?.id) return;

    try {
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", event.id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("common.deleteSuccess"),
      });
      onDelete?.(event.id);
      onEventDeleted?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.deleteError"),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {event ? t("crm.editEvent") : t("crm.addEvent")}
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
            eventName=""
            setEventName={() => {}}
            startDate={startDate.toISOString()}
            setStartDate={(dateString: string) => setStartDate(new Date(dateString))}
            endDate={endDate.toISOString()}
            setEndDate={(dateString: string) => setEndDate(new Date(dateString))}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            selectedFile={null}
            setSelectedFile={() => {}}
            fileError=""
            setFileError={() => {}}
            displayedFiles={[]}
            onFileDeleted={() => {}}
            repeatPattern="none"
            setRepeatPattern={() => {}}
            repeatUntil={undefined}
            setRepeatUntil={() => {}}
            isNewEvent={!event}
            additionalPersons={additionalPersons.map((person, index) => ({
              id: index.toString(),
              title: person.title,
              userSurname: person.userSurname,
              userNumber: "",
              socialNetworkLink: person.socialNetworkLink,
              eventNotes: "",
              paymentStatus: "not_paid",
              paymentAmount: ""
            }))}
            onAddPerson={handleAddPerson}
            onPersonChange={(personId: string, field: string, value: string) => {
              const index = parseInt(personId);
              handlePersonChange(index, field, value);
            }}
            onRemovePerson={(personId: string) => {
              const index = parseInt(personId);
              handleRemovePerson(index);
            }}
            onUpdatePerson={() => {}}
          />

          <div className="flex justify-between">
            <Button type="submit" className="flex-1 mr-2">
              {event ? t("common.update") : t("common.add")}
            </Button>
            {event && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                {t("common.delete")}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
