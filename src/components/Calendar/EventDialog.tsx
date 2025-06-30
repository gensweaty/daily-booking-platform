
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { EventDialogFields } from "./EventDialogFields";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { testEmailSending } from "@/lib/api";
import { CalendarEventType } from "@/lib/types/calendar";
import { isVirtualInstance, getParentEventId } from "@/lib/recurringEvents";
import { FileRecord } from "@/types/files";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEventType | null;
  onSubmit: (data: any) => Promise<CalendarEventType>;
  onDelete?: (id: string, deleteChoice?: "this" | "series") => Promise<void>;
  isNewEvent?: boolean;
}

// Helper function to fetch event files
async function fetchEventFiles(eventId: string): Promise<FileRecord[]> {
  const { data, error } = await supabase
    .from('event_files')
    .select('*')
    .eq('event_id', eventId);
    
  if (error) {
    console.error('Error fetching event files:', error);
    return [];
  }
  
  return (data || []).map(file => ({
    id: file.id,
    filename: file.filename,
    file_path: file.file_path,
    content_type: file.content_type || null,
    size: file.size || null,
    created_at: file.created_at || new Date().toISOString(),
    user_id: file.user_id || null,
    event_id: file.event_id || null,
    customer_id: null,
    parentType: 'event' as const
  }));
}

export const EventDialog = ({
  open,
  onOpenChange,
  event,
  onSubmit,
  onDelete,
  isNewEvent = false
}: EventDialogProps) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    title: "",
    user_surname: "",
    user_number: "",
    social_network_link: "",
    event_notes: "",
    event_name: "",
    start_date: "",
    end_date: "",
    payment_status: "not_paid",
    payment_amount: "",
    repeat_pattern: "none",
    repeat_until: undefined as Date | undefined,
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteChoice, setDeleteChoice] = useState<"this" | "series">("this");

  // Initialize form data when event changes
  useEffect(() => {
    if (event) {
      const eventStartDate = event.start_date ? new Date(event.start_date) : new Date();
      const eventEndDate = event.end_date ? new Date(event.end_date) : new Date();
      
      setFormData({
        title: event.title || "",
        user_surname: event.user_surname || "",
        user_number: event.user_number || "",
        social_network_link: event.social_network_link || "",
        event_notes: event.event_notes || "",
        event_name: event.event_name || "",
        start_date: eventStartDate.toISOString().slice(0, 16),
        end_date: eventEndDate.toISOString().slice(0, 16),
        payment_status: event.payment_status || "not_paid",
        payment_amount: event.payment_amount?.toString() || "",
        repeat_pattern: event.repeat_pattern || "none",
        repeat_until: event.repeat_until ? new Date(event.repeat_until) : undefined,
      });
    } else {
      // Reset form for new events
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      
      setFormData({
        title: "",
        user_surname: "",
        user_number: "",
        social_network_link: "",
        event_notes: "",
        event_name: "",
        start_date: now.toISOString().slice(0, 16),
        end_date: oneHourLater.toISOString().slice(0, 16),
        payment_status: "not_paid",
        payment_amount: "",
        repeat_pattern: "none",
        repeat_until: undefined,
      });
    }
  }, [event]);

  // Load files when dialog opens with existing event
  useEffect(() => {
    const loadFiles = async () => {
      if (!open) {
        setDisplayedFiles([]);
        setSelectedFile(null);
        setFileError("");
        return;
      }

      if (event?.id && !isVirtualInstance(event.id)) {
        try {
          const files = await fetchEventFiles(event.id);
          setDisplayedFiles(files);
        } catch (error) {
          console.error("Error loading files:", error);
          setDisplayedFiles([]);
        }
      } else {
        setDisplayedFiles([]);
      }
    };

    loadFiles();
  }, [open, event?.id]);

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
      const eventData = {
        ...formData,
        user_id: user.id,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        payment_amount: formData.payment_amount ? parseFloat(formData.payment_amount) : null,
        is_recurring: formData.repeat_pattern !== "none",
        repeat_pattern: formData.repeat_pattern !== "none" ? formData.repeat_pattern : null,
        repeat_until: formData.repeat_until?.toISOString() || null,
        id: event?.id,
      };

      console.log("Submitting event data:", eventData);

      // Submit the event and get the saved event back
      const savedEvent = await onSubmit(eventData);
      
      if (!savedEvent?.id) {
        throw new Error("Event ID missing after save.");
      }

      console.log("Event saved with ID:", savedEvent.id);

      // Handle file upload if there's a selected file
      if (selectedFile && user) {
        console.log("Uploading file for event:", savedEvent.id);
        
        // 1. Upload file to storage
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${savedEvent.id}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        // 2. Create file record
        const fileData = {
          filename: selectedFile.name,
          file_path: filePath,
          content_type: selectedFile.type,
          size: selectedFile.size,
          user_id: user.id,
          event_id: savedEvent.id
        };

        const { error: insertError } = await supabase
          .from('event_files')
          .insert(fileData);

        if (insertError) {
          console.error('File record insert error:', insertError);
          throw insertError;
        }

        console.log('✅ File uploaded and recorded for event:', savedEvent.id);
        
        // 3. Refresh the displayed files
        const refreshedFiles = await fetchEventFiles(savedEvent.id);
        setDisplayedFiles(refreshedFiles);
      }

      // Handle additional persons if they exist
      const additionalPersons = (window as any).additionalPersonsData || [];
      
      if (additionalPersons.length > 0) {
        console.log("Creating customers for additional persons:", additionalPersons.length);
        
        for (const person of additionalPersons) {
          const customerData = {
            title: person.userSurname,
            user_surname: person.userSurname,
            user_number: person.userNumber,
            social_network_link: person.socialNetworkLink,
            event_notes: person.eventNotes,
            payment_status: person.paymentStatus,
            payment_amount: person.paymentAmount ? parseFloat(person.paymentAmount) : null,
            user_id: user.id,
            start_date: savedEvent.start_date,
            end_date: savedEvent.end_date,
            type: 'customer'
          };

          const { error: customerError } = await supabase
            .from('customers')
            .insert(customerData);

          if (customerError) {
            console.error("Error creating customer:", customerError);
          }
        }
      }

      // Send email notification if configured
      if (formData.social_network_link && isValidEmail(formData.social_network_link)) {
        await sendEventNotificationEmail(savedEvent, formData);
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });

      toast({
        title: t("common.success"),
        description: event ? t("events.eventUpdated") : t("events.eventCreated")
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.errorOccurred"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (event?.is_recurring && !isVirtualInstance(event.id)) {
      setIsDeleteConfirmOpen(true);
    } else {
      confirmDelete("this");
    }
  };

  const confirmDelete = async (choice: "this" | "series") => {
    if (!event?.id || !onDelete) return;

    try {
      setIsLoading(true);
      await onDelete(event.id, choice);
      setIsDeleteConfirmOpen(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.deleteError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const sendEventNotificationEmail = async (savedEvent: CalendarEventType, formData: any) => {
    try {
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (businessData) {
        await testEmailSending(
          formData.social_network_link,
          formData.user_surname || formData.title || '',
          businessData.business_name || '',
          savedEvent.start_date,
          savedEvent.end_date,
          formData.payment_status || 'not_paid',
          formData.payment_amount || null,
          businessData.contact_address || '',
          savedEvent.id,
          null,
          formData.event_notes || ''
        );
      }
    } catch (error) {
      console.error("Error sending event notification email:", error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>
            {event ? t("events.editEvent") : t("events.addEvent")}
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
              eventNotes={formData.event_notes}
              setEventNotes={(value) => setFormData({ ...formData, event_notes: value })}
              eventName={formData.event_name}
              setEventName={(value) => setFormData({ ...formData, event_name: value })}
              startDate={formData.start_date}
              setStartDate={(value) => setFormData({ ...formData, start_date: value })}
              endDate={formData.end_date}
              setEndDate={(value) => setFormData({ ...formData, end_date: value })}
              paymentStatus={formData.payment_status}
              setPaymentStatus={(value) => setFormData({ ...formData, payment_status: value })}
              paymentAmount={formData.payment_amount}
              setPaymentAmount={(value) => setFormData({ ...formData, payment_amount: value })}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              eventId={event?.id}
              displayedFiles={displayedFiles}
              onFileDeleted={(fileId) => {
                setDisplayedFiles((prev) => prev.filter((file) => file.id !== fileId));
              }}
              repeatPattern={formData.repeat_pattern}
              setRepeatPattern={(value) => setFormData({ ...formData, repeat_pattern: value })}
              repeatUntil={formData.repeat_until}
              setRepeatUntil={(date) => setFormData({ ...formData, repeat_until: date })}
              isNewEvent={isNewEvent}
            />

            <div className="flex justify-between">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 mr-2"
              >
                {event ? t("common.update") : t("common.add")}
              </Button>
              {event && onDelete && (
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
              {t("events.deleteRecurringEvent")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("events.deleteRecurringDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmDelete("this")}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {t("events.deleteThisEvent")}
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={() => confirmDelete("series")}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("events.deleteAllEvents")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
