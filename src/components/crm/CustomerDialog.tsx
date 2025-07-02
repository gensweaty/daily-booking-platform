import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, getStorageUrl } from "@/lib/supabase";
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
  const { t, language } = useLanguage();
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
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
      
      // Set the create_event checkbox state from initialData
      setCreateEvent(initialData.create_event || false);
      
      // Set event dates if they exist in initialData
      if (initialData.start_date) {
        setEventStartDate(new Date(initialData.start_date));
      }
      if (initialData.end_date) {
        setEventEndDate(new Date(initialData.end_date));
      }
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
      setCreateEvent(false);
    }
  }, [initialData]);

  useEffect(() => {
    const loadFiles = async () => {
      if (!customerId) {
        setDisplayedFiles([]);
        return;
      }

      try {
        console.log("[FILES] Loading files for ID:", customerId);
        let filesData: any[] = [];
        
        if (customerId.startsWith('event-')) {
          const eventId = customerId.replace('event-', '');
          console.log("[FILES] Loading event files for event ID:", eventId);
          
          const { data: eventFiles, error: eventFilesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', eventId);

          if (eventFilesError) {
            console.error("[FILES] Error loading event files:", eventFilesError);
          } else {
            filesData = eventFiles || [];
            console.log("[FILES] Event files loaded:", filesData.length);
          }
        } else {
          console.log("[FILES] Loading customer files for customer ID:", customerId);
          
          const { data: customerFiles, error: customerFilesError } = await supabase
            .from('customer_files_new')
            .select('*')
            .eq('customer_id', customerId);

          if (customerFilesError) {
            console.error("[FILES] Error loading customer files:", customerFilesError);
          } else {
            filesData = customerFiles || [];
            console.log("[FILES] Customer files loaded:", filesData.length);
          }
        }

        setDisplayedFiles(filesData);
      } catch (error) {
        console.error("[FILES] Error loading files:", error);
        setDisplayedFiles([]);
      }
    };

    if (open) {
      loadFiles();
      setSelectedFile(null);
      setFileError("");
    }
  }, [open, customerId]);

  const uploadFile = async (entityId: string, file: File, isEvent: boolean = false) => {
    try {
      console.log("[UPLOAD] Starting file upload for:", { entityId, fileName: file.name, isEvent });
      
      const fileExt = file.name.split('.').pop();
      const filePath = `${entityId}/${crypto.randomUUID()}.${fileExt}`;
      const bucketName = isEvent ? 'event_attachments' : 'customer_attachments';
      
      console.log("[UPLOAD] Uploading to bucket:", bucketName, "path:", filePath);

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      if (uploadError) {
        console.error('[UPLOAD] Error uploading file:', uploadError);
        throw uploadError;
      }

      const fileData = {
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
        user_id: user?.id,
        ...(isEvent ? { event_id: entityId } : { customer_id: entityId }),
      };

      console.log("[UPLOAD] Creating file record:", fileData);

      const tableName = isEvent ? 'event_files' : 'customer_files_new';
      const { error: fileRecordError } = await supabase
        .from(tableName)
        .insert(fileData);

      if (fileRecordError) {
        console.error('[UPLOAD] Error creating file record:', fileRecordError);
        throw fileRecordError;
      }

      console.log("[UPLOAD] File upload completed successfully");
      return fileData;
    } catch (error: any) {
      console.error("[UPLOAD] Error during file upload:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.uploadError"),
        variant: "destructive",
      });
      throw error;
    }
  };

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Enhanced email sending function with comprehensive logging
  const sendEventCreationEmail = async (eventData: any) => {
    try {
      console.log("[EMAIL] ========== STARTING EMAIL SENDING PROCESS ==========");
      console.log("[EMAIL] Event data received:", {
        id: eventData.id,
        title: eventData.title,
        email: eventData.social_network_link,
        startDate: eventData.start_date,
        endDate: eventData.end_date,
        paymentStatus: eventData.payment_status,
        paymentAmount: eventData.payment_amount,
        eventNotes: eventData.event_notes
      });
      
      // Check if we have a valid customer email to send to
      const customerEmail = eventData.social_network_link;
      if (!customerEmail || !isValidEmail(customerEmail)) {
        console.warn("[EMAIL] No valid customer email found:", customerEmail);
        toast({
          title: t("common.warning"),
          description: "No valid email address provided - notification not sent",
          variant: "destructive"
        });
        return;
      }
      
      console.log("[EMAIL] Valid email address confirmed:", customerEmail);
      
      // Get user's business profile for the email
      console.log("[EMAIL] Fetching business profile for user:", user?.id);
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (businessError) {
        console.error("[EMAIL] Error fetching business profile:", businessError);
        toast({
          title: t("common.warning"),
          description: "Could not load business profile for email",
          variant: "destructive"
        });
        return;
      }
      
      console.log("[EMAIL] Business profile loaded:", {
        businessName: businessData?.business_name,
        contactAddress: businessData?.contact_address
      });
      
      if (businessData) {
        const emailPayload = {
          recipientEmail: customerEmail,
          fullName: eventData.title || eventData.user_surname || '',
          businessName: businessData.business_name || 'Our Business',
          startDate: eventData.start_date,
          endDate: eventData.end_date,
          paymentStatus: eventData.payment_status || 'not_paid',
          paymentAmount: eventData.payment_amount || null,
          businessAddress: businessData.contact_address || 'Address not provided',
          eventId: eventData.id,
          source: 'event-creation',
          language: language || 'en',
          eventNotes: eventData.event_notes || ''
        };
        
        console.log("[EMAIL] Sending email with payload:", emailPayload);
        
        // Use Supabase function invoke
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-booking-approval-email',
          {
            body: emailPayload
          }
        );
        
        if (emailError) {
          console.error("[EMAIL] Failed to send event creation email:", emailError);
          toast({
            title: t("common.warning"),
            description: `Email sending failed: ${emailError.message}`,
            variant: "destructive"
          });
        } else {
          console.log("[EMAIL] Event creation email sent successfully:", emailResult);
          toast({
            title: t("common.success"),
            description: "Event created and notification email sent successfully!",
          });
        }
      } else {
        console.warn("[EMAIL] Missing business data for event notification");
        toast({
          title: t("common.warning"),
          description: "Event created but email notification failed - missing business profile",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("[EMAIL] Error in email sending process:", error);
      toast({
        title: t("common.warning"),
        description: `Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
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
      const { title, user_number, social_network_link, event_notes, payment_status, payment_amount } = formData;

      console.log("[SUBMIT] Starting form submission:", {
        customerId,
        title,
        createEvent,
        hasEmail: !!social_network_link,
        isValidEmail: social_network_link ? isValidEmail(social_network_link) : false
      });

      // For existing customers/events (update operation)
      if (customerId) {
        console.log("[SUBMIT] Updating existing entity:", customerId);
        
        const updates = {
          title,
          user_number,
          social_network_link,
          event_notes,
          payment_status,
          payment_amount: payment_amount ? parseFloat(payment_amount) : null,
          user_id: user.id,
          create_event: createEvent,
          start_date: createEvent ? eventStartDate.toISOString() : null,
          end_date: createEvent ? eventEndDate.toISOString() : null
        };

        let tableToUpdate = 'customers';
        let id = customerId;
        let isEventEntity = false;

        if (customerId.startsWith('event-')) {
          tableToUpdate = 'events';
          id = customerId.replace('event-', '');
          isEventEntity = true;
        }

        console.log("[SUBMIT] Updating table:", tableToUpdate, "ID:", id);

        const { data, error } = await supabase
          .from(tableToUpdate)
          .update(updates)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        console.log("[SUBMIT] Entity updated successfully:", data);

        // Handle file upload for existing entity
        if (selectedFile) {
          try {
            console.log("[SUBMIT] Uploading file for existing entity");
            await uploadFile(isEventEntity ? id : customerId, selectedFile, isEventEntity);
            
            // Reload files after upload
            setDisplayedFiles(prev => [...prev]);
          } catch (uploadError) {
            console.error("[SUBMIT] File upload failed:", uploadError);
          }
        }

        // Send email for event updates if it's an event with a valid email
        if (isEventEntity && social_network_link && isValidEmail(social_network_link)) {
          console.log("[SUBMIT] Sending email for updated event");
          await sendEventCreationEmail({
            id: id,
            title: title,
            user_surname: title,
            social_network_link: social_network_link,
            start_date: eventStartDate.toISOString(),
            end_date: eventEndDate.toISOString(),
            payment_status: payment_status,
            payment_amount: payment_amount ? parseFloat(payment_amount) : null,
            event_notes: event_notes
          });
        }

        // If this is a customer and create_event is checked, create or update the corresponding event
        if (tableToUpdate === 'customers' && createEvent) {
          console.log("[SUBMIT] Creating/updating event for customer");
          
          // Check if there's already an event with this title
          const { data: existingEvents, error: eventCheckError } = await supabase
            .from('events')
            .select('id')
            .eq('title', title)
            .eq('user_id', user.id)
            .is('deleted_at', null);
            
          if (eventCheckError) {
            console.error("[SUBMIT] Error checking for existing events:", eventCheckError);
          }
          
          const eventData = {
            title: title,
            user_surname: title,
            user_number: user_number,
            social_network_link: social_network_link,
            event_notes: event_notes,
            payment_status: payment_status,
            payment_amount: payment_amount ? parseFloat(payment_amount) : null,
            user_id: user.id,
            start_date: eventStartDate.toISOString(),
            end_date: eventEndDate.toISOString(),
          };

          let createdEventId: string | null = null;

          if (existingEvents && existingEvents.length > 0) {
            console.log("[SUBMIT] Updating existing event:", existingEvents[0].id);
            
            const { data: updatedEvent, error: eventUpdateError } = await supabase
              .from('events')
              .update(eventData)
              .eq('id', existingEvents[0].id)
              .select()
              .single();

            if (eventUpdateError) {
              console.error("[SUBMIT] Error updating event:", eventUpdateError);
              toast({
                title: t("common.warning"),
                description: t("crm.eventUpdateFailed"),
                variant: "destructive"
              });
            } else {
              createdEventId = updatedEvent.id;
              console.log("[SUBMIT] Event updated, sending email");
              await sendEventCreationEmail({
                ...updatedEvent,
                event_notes: event_notes
              });
            }
          } else {
            console.log("[SUBMIT] Creating new event for customer");
            
            const { data: newEvent, error: eventCreateError } = await supabase
              .from('events')
              .insert(eventData)
              .select()
              .single();

            if (eventCreateError) {
              console.error("[SUBMIT] Error creating event:", eventCreateError);
              toast({
                title: t("common.warning"),
                description: t("crm.eventCreationFailed"),
                variant: "destructive"
              });
            } else {
              createdEventId = newEvent.id;
              console.log("[SUBMIT] New event created, sending email");
              await sendEventCreationEmail({
                ...newEvent,
                event_notes: event_notes
              });
            }
          }
        }
      } 
      // For new customers (insert operation)
      else {
        console.log("[SUBMIT] Creating new customer");
        
        const newCustomer = {
          title,
          user_number,
          social_network_link,
          event_notes,
          payment_status,
          payment_amount: payment_amount ? parseFloat(payment_amount) : null,
          user_id: user.id,
          create_event: createEvent,
          start_date: createEvent ? eventStartDate.toISOString() : null,
          end_date: createEvent ? eventEndDate.toISOString() : null
        };

        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .insert(newCustomer)
          .select()
          .single();

        if (customerError) {
          console.error("[SUBMIT] Error creating customer:", customerError);
          throw customerError;
        }

        console.log("[SUBMIT] Customer created:", customerData.id);

        // Handle file upload for the new customer if a file was selected
        if (selectedFile && customerData) {
          try {
            console.log("[SUBMIT] Uploading file for new customer");
            await uploadFile(customerData.id, selectedFile, false);
          } catch (uploadError) {
            console.error("[SUBMIT] File upload failed:", uploadError);
          }
        }

        // Create corresponding event if checkbox was checked
        if (createEvent && customerData) {
          console.log("[SUBMIT] Creating event from new customer");
          
          const eventData = {
            title: title,
            user_surname: title,
            user_number: user_number,
            social_network_link: social_network_link,
            event_notes: event_notes,
            payment_status: payment_status,
            payment_amount: payment_amount ? parseFloat(payment_amount) : null,
            user_id: user.id,
            start_date: eventStartDate.toISOString(),
            end_date: eventEndDate.toISOString(),
          };

          const { data: eventResult, error: eventError } = await supabase
            .from('events')
            .insert(eventData)
            .select()
            .single();

          if (eventError) {
            console.error("[SUBMIT] Error creating event:", eventError);
            toast({
              title: t("common.warning"),
              description: t("crm.eventCreationFailed"),
              variant: "destructive"
            });
          } else {
            console.log("[SUBMIT] Event created successfully:", eventResult.id);
            
            // Send email notification to customer's email when creating a new event
            if (social_network_link && isValidEmail(social_network_link)) {
              console.log("[SUBMIT] Sending email for new customer event");
              await sendEventCreationEmail({
                id: eventResult.id,
                title: title,
                user_surname: title,
                social_network_link: social_network_link,
                start_date: eventStartDate.toISOString(),
                end_date: eventEndDate.toISOString(),
                payment_status: payment_status,
                payment_amount: payment_amount ? parseFloat(payment_amount) : null,
                event_notes: event_notes
              });
            }
          }
        }
      }

      // Invalidate queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });

      toast({
        title: t("common.success"),
        description: customerId ? t("crm.customerUpdated") : t("crm.customerCreated")
      });
      
      console.log("[SUBMIT] Form submission completed successfully");
      onOpenChange(false);
    } catch (error: any) {
      console.error("[SUBMIT] Error in form submission:", error);
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
              fileBucketName={customerId?.startsWith('event-') ? "event_attachments" : "customer_attachments"}
              fallbackBuckets={["event_attachments", "customer_attachments", "booking_attachments"]}
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
