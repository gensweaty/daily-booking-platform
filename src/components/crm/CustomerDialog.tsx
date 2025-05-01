
import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { CustomerDialogFields } from "./CustomerDialogFields";
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

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string | null;
  initialData?: any;
}

export const CustomerDialog = ({
  open,
  onOpenChange,
  customerId,
  initialData,
}: CustomerDialogProps) => {
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
    startDate: "",
    endDate: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Add state for delete confirmation dialog
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Add state for event date/time pickers
  const [eventStartDate, setEventStartDate] = useState<Date>(new Date());
  const [eventEndDate, setEventEndDate] = useState<Date>(new Date());
  const [createEvent, setCreateEvent] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        user_number: initialData.user_number || "",
        social_network_link: initialData.social_network_link || "",
        event_notes: initialData.event_notes || "",
        payment_status: initialData.payment_status || "not_paid",
        payment_amount: initialData.payment_amount?.toString() || "",
        startDate: initialData.startDate || "",
        endDate: initialData.endDate || "",
      });
    } else {
      setFormData({
        title: "",
        user_number: "",
        social_network_link: "",
        event_notes: "",
        payment_status: "not_paid",
        payment_amount: "",
        startDate: "",
        endDate: "",
      });
    }
  }, [initialData]);

  useEffect(() => {
    const loadFiles = async () => {
      if (!customerId) {
        setDisplayedFiles([]);
        return;
      }

      try {
        let filesData: any[] = [];
        if (customerId.startsWith('event-')) {
          const eventId = customerId.replace('event-', '');
          const { data: eventFiles, error: eventFilesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', eventId);

          if (eventFilesError) {
            console.error("Error loading event files:", eventFilesError);
          } else {
            filesData = eventFiles || [];
          }
        } else {
          const { data: customerFiles, error: customerFilesError } = await supabase
            .from('customer_files_new')
            .select('*')
            .eq('customer_id', customerId);

          if (customerFilesError) {
            console.error("Error loading customer files:", customerFilesError);
          } else {
            filesData = customerFiles || [];
          }
        }

        setDisplayedFiles(filesData);
      } catch (error) {
        console.error("Error loading files:", error);
        setDisplayedFiles([]);
      }
    };

    if (open) {
      loadFiles();
      setSelectedFile(null);
      setFileError("");
    }
  }, [open, customerId]);

  const uploadFile = async (customerId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${customerId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('customer_attachments')
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
        customer_id: customerId,
      };

      const { error: fileRecordError } = await supabase
        .from('customer_files_new')
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

      const updates = {
        title,
        user_number,
        social_network_link,
        event_notes,
        payment_status,
        payment_amount: payment_amount ? parseFloat(payment_amount) : null,
        user_id: user.id,
      };

      let tableToUpdate = 'customers';
      let id = customerId;

      if (customerId?.startsWith('event-')) {
        tableToUpdate = 'events';
        id = customerId.replace('event-', '');
      }

      const { data, error } = await supabase
        .from(tableToUpdate)
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (selectedFile && customerId && !customerId?.startsWith('event-')) {
        try {
          await uploadFile(customerId, selectedFile);
        } catch (uploadError) {
          console.error("File upload failed:", uploadError);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });

      toast({
        title: t("common.success"),
        description: t("common.updateSuccess"),
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating data:", error);
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
    // Open confirmation dialog instead of deleting immediately
    setIsDeleteConfirmOpen(true);
  };

  // Add new function to handle confirmed deletion
  const handleConfirmDelete = async () => {
    if (!customerId || !user?.id) return;

    try {
      setIsLoading(true);

      let tableToUpdate = 'customers';
      let id = customerId;

      if (customerId.startsWith('event-')) {
        tableToUpdate = 'events';
        id = customerId.replace('event-', '');
      }

      const { error } = await supabase
        .from(tableToUpdate)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      
      toast({
        title: t("common.success"),
        description: t("common.deleteSuccess"),
      });

      onOpenChange(false);
      // Close delete confirmation dialog
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
            {customerId ? t("crm.editCustomer") : t("crm.addCustomer")}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="space-y-4">
            <CustomerDialogFields
              title={formData.title}
              setTitle={(value) => setFormData({ ...formData, title: value })}
              userSurname=""
              setUserSurname={() => {}}
              userNumber={formData.user_number}
              setUserNumber={(value) => setFormData({ ...formData, user_number: value })}
              socialNetworkLink={formData.social_network_link}
              setSocialNetworkLink={(value) => setFormData({ ...formData, social_network_link: value })}
              createEvent={createEvent}
              setCreateEvent={setCreateEvent}
              paymentStatus={formData.payment_status}
              setPaymentStatus={(value) => setFormData({ ...formData, payment_status: value })}
              paymentAmount={formData.payment_amount}
              setPaymentAmount={(value) => setFormData({ ...formData, payment_amount: value })}
              customerNotes={formData.event_notes}
              setCustomerNotes={(value) => setFormData({ ...formData, event_notes: value })}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              isEventBased={customerId?.startsWith('event-') || false}
              startDate={formData.startDate}
              endDate={formData.endDate}
              customerId={customerId}
              displayedFiles={displayedFiles}
              onFileDeleted={(fileId) => {
                setDisplayedFiles((prev) => prev.filter((file) => file.id !== fileId));
              }}
              eventStartDate={eventStartDate}
              setEventStartDate={setEventStartDate}
              eventEndDate={eventEndDate}
              setEventEndDate={setEventEndDate}
            />

            <div className="flex justify-between">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 mr-2"
              >
                {customerId ? t("common.update") : t("common.add")}
              </Button>
              {customerId && (
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
      
      {/* Add deletion confirmation dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("common.delete")}
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
