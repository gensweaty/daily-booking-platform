
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
  date?: Date;
  // Modified to use Date type
  selectedDate?: Date;
  event?: any;
  onSubmit?: (data: any) => Promise<any>;
  onDelete?: () => Promise<void>;
}

export const EventDialog = ({
  open,
  onOpenChange,
  eventId,
  initialData,
  date,
  selectedDate, 
  event, 
  onSubmit, 
  onDelete,
}: EventDialogProps) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    user_number: "",
    social_network_link: "",
    event_notes: "",
    payment_status: "not_paid",
    payment_amount: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date>(date || selectedDate || new Date());
  const [endDate, setEndDate] = useState<Date>(() => {
    const end = new Date(date || selectedDate || new Date());
    end.setHours(end.getHours() + 1);
    return end;
  });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const isEditMode = !!eventId || !!event;

  useEffect(() => {
    // Use event prop if available (used in Calendar component)
    const dataToUse = event || initialData;
    
    if (dataToUse) {
      setFormData({
        title: dataToUse.title || "",
        user_number: dataToUse.user_number || "",
        social_network_link: dataToUse.social_network_link || "",
        event_notes: dataToUse.event_notes || "",
        payment_status: dataToUse.payment_status || "not_paid",
        payment_amount: dataToUse.payment_amount?.toString() || "",
      });

      if (dataToUse.start_date) {
        setStartDate(new Date(dataToUse.start_date));
      }
      if (dataToUse.end_date) {
        setEndDate(new Date(dataToUse.end_date));
      }
    } else {
      setFormData({
        title: "",
        user_number: "",
        social_network_link: "",
        event_notes: "",
        payment_status: "not_paid",
        payment_amount: "",
      });
      
      // Use selectedDate from Calendar component if available
      const dateToUse = date || selectedDate;
      if (dateToUse) {
        setStartDate(dateToUse);
        const end = new Date(dateToUse);
        end.setHours(end.getHours() + 1);
        setEndDate(end);
      } else {
        setStartDate(new Date());
        const end = new Date();
        end.setHours(end.getHours() + 1);
        setEndDate(end);
      }
    }
  }, [initialData, date, selectedDate, event]);

  useEffect(() => {
    // Handle loading files for the event
    const targetEventId = eventId || (event?.id);
    
    const loadFiles = async () => {
      if (!targetEventId) {
        setDisplayedFiles([]);
        return;
      }

      try {
        const { data: eventFiles, error: eventFilesError } = await supabase
          .from('event_files')
          .select('*')
          .eq('event_id', targetEventId);

        if (eventFilesError) {
          console.error("Error loading event files:", eventFilesError);
          setDisplayedFiles([]);
        } else {
          setDisplayedFiles(eventFiles || []);
        }
      } catch (error) {
        console.error("Error loading files:", error);
        setDisplayedFiles([]);
      }
    };

    if (open && targetEventId) {
      loadFiles();
      setSelectedFile(null);
      setFileError("");
    }
  }, [open, eventId, event]);

  const uploadFile = async (eventId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `events/${eventId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('event_attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw uploadError;
      }

      const fileData = {
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
        user_id: user?.id,
        event_id: eventId,
      };

      const { error: fileRecordError } = await supabase
        .from('event_files')
        .insert(fileData);

      if (fileRecordError) {
        console.error('Error creating file record:', fileRecordError);
        throw fileRecordError;
      }

      return fileData;
    } catch (error: any) {
      console.error("Error during file upload:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.uploadError"),
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If using the onSubmit prop from Calendar component
    if (onSubmit) {
      try {
        setIsLoading(true);
        const eventData = {
          ...formData,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          // If we have event, use its id for update
          ...(event?.id ? { id: event.id } : {})
        };
        
        await onSubmit(eventData);
        onOpenChange(false);
      } catch (error: any) {
        console.error("Error handling event:", error);
        toast({
          title: t("common.error"),
          description: error.message || t("common.updateError"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Default behavior when not using Calendar's onSubmit
    if (!user?.id) {
      toast({
        title: t("common.error"),
        description: t("common.missingUserInfo"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { title, user_number, social_network_link, event_notes, payment_status, payment_amount } = formData;

      const eventData = {
        title,
        user_number,
        social_network_link,
        event_notes,
        payment_status,
        payment_amount: payment_amount ? parseFloat(payment_amount) : null,
        user_id: user.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      };

      if (eventId) {
        // Update existing event
        const { data, error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', eventId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        if (selectedFile) {
          try {
            await uploadFile(eventId, selectedFile);
          } catch (uploadError) {
            console.error("File upload failed:", uploadError);
          }
        }
      } else {
        // Create new event
        const { data: newEvent, error } = await supabase
          .from('events')
          .insert(eventData)
          .select()
          .single();

        if (error) throw error;

        if (selectedFile && newEvent) {
          try {
            await uploadFile(newEvent.id, selectedFile);
          } catch (uploadError) {
            console.error("File upload failed:", uploadError);
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });

      toast({
        title: t("common.success"),
        description: isEditMode ? t("events.eventUpdated") : t("events.createEvent"),
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating event:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.updateError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    // If using onDelete from Calendar
    if (onDelete) {
      try {
        setIsDeleteConfirmOpen(true);
      } catch (error: any) {
        console.error("Error with delete:", error);
        toast({
          title: t("common.error"),
          description: error.message || t("common.deleteError"),
          variant: "destructive",
        });
      }
      return;
    }
    
    // Default delete behavior
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (onDelete) {
      try {
        setIsLoading(true);
        await onDelete();
        onOpenChange(false);
        setIsDeleteConfirmOpen(false);
      } catch (error: any) {
        console.error("Error deleting event:", error);
        toast({
          title: t("common.error"),
          description: error.message || t("common.deleteError"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Default delete implementation
    const targetEventId = eventId || (event?.id);
    if (!targetEventId || !user?.id) return;

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', targetEventId)
        .eq('user_id', user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      
      toast({
        title: t("common.success"),
        description: t("events.eventDeleted"),
      });

      onOpenChange(false);
      setIsDeleteConfirmOpen(false);
    } catch (error: any) {
      console.error('Error deleting event:', error);
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
            {isEditMode ? t("events.editEvent") : t("events.addNewEvent")}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="space-y-4">
            <EventDialogFields
              title={formData.title}
              setTitle={(value) => setFormData({ ...formData, title: value })}
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
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              eventId={eventId || (event?.id)}
              displayedFiles={displayedFiles}
              onFileDeleted={(fileId) => {
                setDisplayedFiles((prev) => prev.filter((file) => file.id !== fileId));
              }}
            />

            <div className="flex justify-between">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 mr-2"
              >
                {isEditMode ? t("events.updateEvent") : t("events.createEvent")}
              </Button>
              {isEditMode && (
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
              {t("events.deleteEvent")}
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
