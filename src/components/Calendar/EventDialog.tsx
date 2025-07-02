
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { EventDialogFields } from "./EventDialogFields";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { sendEventCreationEmail, sendBookingConfirmationToMultipleRecipients } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string | null;
  initialData?: any;
  selectedDate?: Date;
  event?: any;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

export const EventDialog = ({
  open,
  onOpenChange,
  eventId,
  initialData,
  selectedDate,
  event,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
}: EventDialogProps) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { businessProfile } = useBusinessProfile();
  
  // Use event data if provided, otherwise use initialData
  const eventData = event || initialData;
  const currentEventId = eventId || event?.id;
  
  const [formData, setFormData] = useState({
    title: "",
    user_surname: "",
    user_number: "",
    social_network_link: "",
    event_notes: "",
    eventName: "",
    payment_status: "not_paid",
    payment_amount: "",
    startDate: selectedDate ? selectedDate.toISOString() : "",
    endDate: selectedDate ? selectedDate.toISOString() : "",
    repeatPattern: "none",
    repeatUntil: undefined as Date | undefined,
    additionalPersons: [] as any[],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (eventData) {
      setFormData({
        title: eventData.title || "",
        user_surname: eventData.user_surname || "",
        user_number: eventData.user_number || "",
        social_network_link: eventData.social_network_link || "",
        event_notes: eventData.event_notes || "",
        eventName: eventData.event_name || "",
        payment_status: eventData.payment_status || "not_paid",
        payment_amount: eventData.payment_amount?.toString() || "",
        startDate: eventData.start_date || "",
        endDate: eventData.end_date || "",
        repeatPattern: "none",
        repeatUntil: undefined,
        additionalPersons: [],
      });
    } else if (selectedDate) {
      setFormData({
        title: "",
        user_surname: "",
        user_number: "",
        social_network_link: "",
        event_notes: "",
        eventName: "",
        payment_status: "not_paid",
        payment_amount: "",
        startDate: selectedDate.toISOString(),
        endDate: selectedDate.toISOString(),
        repeatPattern: "none",
        repeatUntil: undefined,
        additionalPersons: [],
      });
    } else {
      setFormData({
        title: "",
        user_surname: "",
        user_number: "",
        social_network_link: "",
        event_notes: "",
        eventName: "",
        payment_status: "not_paid",
        payment_amount: "",
        startDate: "",
        endDate: "",
        repeatPattern: "none",
        repeatUntil: undefined,
        additionalPersons: [],
      });
    }
  }, [eventData, selectedDate]);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const sendEventNotification = async (eventData: any, additionalPersons: any[] = []) => {
    try {
      console.log(`🔔 Starting email notification for event: ${eventData.title}`);
      console.log("📊 Using business profile:", businessProfile);
      
      if (!businessProfile) {
        console.warn("❌ Missing business profile - skipping email notification");
        return;
      }

      const recipients: Array<{ email: string; name: string }> = [];
      
      // Add main contact if valid email
      const mainEmail = eventData.social_network_link;
      if (mainEmail && isValidEmail(mainEmail)) {
        recipients.push({
          email: mainEmail,
          name: eventData.title || eventData.user_surname || ''
        });
      }
      
      // Add additional persons
      if (additionalPersons?.length > 0) {
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
        console.warn("❌ No valid email addresses for notifications");
        return;
      }
      
      console.log(`📧 Sending to ${recipients.length} recipients`);
      
      // Send event creation emails
      if (recipients.length === 1) {
        const result = await sendEventCreationEmail(
          recipients[0].email,
          recipients[0].name,
          businessProfile.business_name || '',
          eventData.start_date,
          eventData.end_date,
          eventData.payment_status || 'not_paid',
          eventData.payment_amount || null,
          businessProfile.contact_address || '',
          eventData.id,
          language || 'en',
          eventData.event_notes || ''
        );
        
        if (result?.success) {
          toast({
            title: "Notification Sent",
            description: `Event confirmation sent to ${recipients[0].email}`
          });
        } else {
          toast({
            variant: "destructive",
            title: "Email Failed",
            description: `Failed to send confirmation to ${recipients[0].email}`
          });
        }
      } else {
        const results = await sendBookingConfirmationToMultipleRecipients(
          recipients,
          businessProfile.business_name || '',
          eventData.start_date,
          eventData.end_date,
          eventData.payment_status || 'not_paid',
          eventData.payment_amount || null,
          businessProfile.contact_address || '',
          eventData.id,
          language || 'en',
          eventData.event_notes || ''
        );
        
        if (results.successful > 0) {
          toast({
            title: "Notifications Sent",
            description: `Confirmations sent to ${results.successful} of ${results.total} recipients`
          });
        }
        
        if (results.failed > 0) {
          toast({
            variant: "destructive",
            title: "Some Emails Failed",
            description: `${results.failed} notifications failed to send`
          });
        }
      }
    } catch (error) {
      console.error("❌ Error sending event notification:", error);
      toast({
        variant: "destructive",
        title: "Email Error",
        description: "Failed to send event confirmation emails"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: t("common.error"),
        description: t("common.missingUserInfo"),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { title, user_surname, user_number, social_network_link, event_notes, eventName, payment_status, payment_amount, startDate, endDate } = formData;

      const updates = {
        title: eventName || title,
        user_surname,
        user_number,
        social_network_link,
        event_notes,
        payment_status,
        payment_amount: payment_amount ? parseFloat(payment_amount) : null,
        user_id: user.id,
        start_date: startDate,
        end_date: endDate,
      };

      if (currentEventId) {
        const { data, error } = await supabase
          .from('events')
          .update(updates)
          .eq('id', currentEventId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        // Send email notification after updating the event
        if (data) {
          await sendEventNotification(data, formData.additionalPersons);
        }

        onEventUpdated?.();
      } else {
        const newEvent = {
          title: eventName || title,
          user_surname,
          user_number,
          social_network_link,
          event_notes,
          payment_status,
          payment_amount: payment_amount ? parseFloat(payment_amount) : null,
          user_id: user.id,
          start_date: startDate,
          end_date: endDate,
        };

        const { data, error } = await supabase
          .from('events')
          .insert([newEvent])
          .select()
          .single();

        if (error) throw error;

        // Send email notification after creating the event
        if (data) {
          await sendEventNotification(data, formData.additionalPersons);
        }

        onEventCreated?.();
      }

      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: t("common.success"),
        description: currentEventId ? t("crm.eventUpdated") : t("crm.eventCreated")
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating data:", error);
      toast({
        title: t("common.error"),
        description: t("common.errorOccurred"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentEventId || !user?.id) return;

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', currentEventId)
        .eq('user_id', user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: t("common.success"),
        description: t("common.deleteSuccess"),
      });

      onEventDeleted?.();
      onOpenChange(false);
      setIsDeleteConfirmOpen(false);
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.deleteError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>
            {currentEventId ? t("crm.editEvent") : t("crm.addEvent")}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="space-y-4">
            <EventDialogFields
              title={formData.title}
              setTitle={(value) => setFormData({ ...formData, title: value })}
              userSurname={formData.user_surname}
              setUserSurname={(value) => setFormData({ ...formData, user_surname: value })}
              userNumber={formData.user_number}
              setUserNumber={(value) => setFormData({ ...formData, user_number: value })}
              socialNetworkLink={formData.social_network_link}
              setSocialNetworkLink={(value) => setFormData({ ...formData, social_network_link: value })}
              paymentStatus={formData.payment_status}
              setPaymentStatus={(value) => setFormData({ ...formData, payment_status: value })}
              paymentAmount={formData.payment_amount}
              setPaymentAmount={(value) => setFormData({ ...formData, payment_amount: value })}
              eventNotes={formData.event_notes}
              setEventNotes={(value) => setFormData({ ...formData, event_notes: value })}
              eventName={formData.eventName}
              setEventName={(value) => setFormData({ ...formData, eventName: value })}
              startDate={formData.startDate}
              setStartDate={(value) => setFormData({ ...formData, startDate: value })}
              endDate={formData.endDate}
              setEndDate={(value) => setFormData({ ...formData, endDate: value })}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              eventId={currentEventId}
              displayedFiles={displayedFiles}
              onFileDeleted={(fileId) => {
                setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
              }}
              repeatPattern={formData.repeatPattern}
              setRepeatPattern={(value) => setFormData({ ...formData, repeatPattern: value })}
              repeatUntil={formData.repeatUntil}
              setRepeatUntil={(value) => setFormData({ ...formData, repeatUntil: value })}
              isNewEvent={!currentEventId}
              additionalPersons={formData.additionalPersons}
              onAddPerson={() => {
                const newPerson = {
                  id: crypto.randomUUID(),
                  userSurname: "",
                  userNumber: "",
                  socialNetworkLink: "",
                  eventNotes: "",
                  paymentStatus: "not_paid",
                  paymentAmount: "",
                };
                setFormData({ ...formData, additionalPersons: [...formData.additionalPersons, newPerson] });
              }}
              onRemovePerson={(personId) => {
                setFormData({ 
                  ...formData, 
                  additionalPersons: formData.additionalPersons.filter(p => p.id !== personId) 
                });
              }}
              onUpdatePerson={(personId, field, value) => {
                setFormData({
                  ...formData,
                  additionalPersons: formData.additionalPersons.map(p => 
                    p.id === personId ? { ...p, [field]: value } : p
                  )
                });
              }}
            />

            <div className="flex justify-between">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 mr-2"
              >
                {currentEventId ? t("common.update") : t("common.add")}
              </Button>
              {currentEventId && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("common.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
