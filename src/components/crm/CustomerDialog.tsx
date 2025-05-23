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
import { testEmailSending } from "@/lib/api"; // Import the email sending function

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

        console.log("Files loaded for customer/event:", filesData);
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

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Helper function to send email notification for new event
  const sendEventCreationEmail = async (eventData: any) => {
    try {
      // Check if we have a valid customer email to send to
      const customerEmail = eventData.social_network_link;
      if (!customerEmail || !isValidEmail(customerEmail)) {
        console.warn("No valid customer email found for sending notification");
        return;
      }
      
      // Get user's business profile for the email
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      console.log("Business data for email:", businessData);
      
      if (businessData) {
        // Send email notification to the customer's email address
        // Use the same email format/template as the calendar event emails
        const emailResult = await testEmailSending(
          customerEmail, // Customer's email
          eventData.title || eventData.user_surname || '', // Customer name
          businessData.business_name || '', // Business name from profile
          eventData.start_date,
          eventData.end_date,
          eventData.payment_status || 'not_paid',
          eventData.payment_amount || null,
          businessData.contact_address || '',
          eventData.id,
          null, // language parameter
          eventData.event_notes || '' // Pass event notes to the email function
        );
        
        console.log("Event creation email result:", emailResult);
        
        if (emailResult?.error) {
          console.warn("Failed to send event creation email:", emailResult.error);
        } else {
          console.log("Event creation email sent successfully to customer:", customerEmail);
        }
      } else {
        console.warn("Missing business data for event notification");
      }
    } catch (error) {
      console.error("Error sending event creation email:", error);
      // Don't throw - we don't want to break the main flow if just the email fails
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

      // For existing customers/events (update operation)
      if (customerId) {
        const updates = {
          title,
          user_number,
          social_network_link,
          event_notes,
          payment_status,
          payment_amount: payment_amount ? parseFloat(payment_amount) : null,
          user_id: user.id,
          create_event: createEvent, // Make sure to update the create_event flag
          start_date: createEvent ? eventStartDate.toISOString() : null,
          end_date: createEvent ? eventEndDate.toISOString() : null
        };

        let tableToUpdate = 'customers';
        let id = customerId;

        if (customerId.startsWith('event-')) {
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

        // If this is a customer and create_event is checked, create or update the corresponding event
        if (tableToUpdate === 'customers' && createEvent) {
          // Check if there's already an event with this title
          const { data: existingEvents, error: eventCheckError } = await supabase
            .from('events')
            .select('id')
            .eq('title', title)
            .eq('user_id', user.id)
            .is('deleted_at', null);
            
          if (eventCheckError) {
            console.error("Error checking for existing events:", eventCheckError);
          }
          
          const eventData = {
            title: title,
            user_surname: title, // Fix: use title as user_surname instead of user_number
            user_number: user_number,
            social_network_link: social_network_link,
            event_notes: event_notes, // Ensure event_notes is included
            payment_status: payment_status,
            payment_amount: payment_amount ? parseFloat(payment_amount) : null,
            user_id: user.id,
            start_date: eventStartDate.toISOString(),
            end_date: eventEndDate.toISOString(),
          };

          let createdEventId: string | null = null;

          if (existingEvents && existingEvents.length > 0) {
            // Update existing event
            const { data: updatedEvent, error: eventUpdateError } = await supabase
              .from('events')
              .update(eventData)
              .eq('id', existingEvents[0].id)
              .select()
              .single();

            if (eventUpdateError) {
              console.error("Error updating event:", eventUpdateError);
              toast({
                title: t("common.warning"),
                description: t("crm.eventUpdateFailed"),
                variant: "destructive"
              });
            } else {
              createdEventId = updatedEvent.id;
              
              // Make sure to send email notification with updated event data including notes
              await sendEventCreationEmail({
                ...updatedEvent,
                event_notes: event_notes // Explicitly ensure notes are included
              });
            }
          } else {
            // Create new event
            const { data: newEvent, error: eventCreateError } = await supabase
              .from('events')
              .insert(eventData)
              .select()
              .single();

            if (eventCreateError) {
              console.error("Error creating event:", eventCreateError);
              toast({
                title: t("common.warning"),
                description: t("crm.eventCreationFailed"),
                variant: "destructive"
              });
            } else {
              createdEventId = newEvent.id;
              
              // Send email notification for the newly created event
              await sendEventCreationEmail({
                ...newEvent,
                event_notes: event_notes // Explicitly ensure notes are included 
              });
            }
          }
        }

        if (selectedFile && customerId && !customerId.startsWith('event-')) {
          try {
            await uploadFile(customerId, selectedFile);
          } catch (uploadError) {
            console.error("File upload failed:", uploadError);
          }
        }
      } 
      // For new customers (insert operation)
      else {
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

        console.log("Creating new customer:", newCustomer);
        
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .insert(newCustomer)
          .select()
          .single();

        if (customerError) {
          console.error("Error creating customer:", customerError);
          throw customerError;
        }

        console.log("Customer created:", customerData);

        // Handle file upload for the new customer if a file was selected
        let uploadedFileData = null;
        if (selectedFile && customerData) {
          try {
            uploadedFileData = await uploadFile(customerData.id, selectedFile);
            console.log("File uploaded for customer:", uploadedFileData);
          } catch (uploadError) {
            console.error("File upload failed:", uploadError);
          }
        }

        // Create corresponding event if checkbox was checked
        if (createEvent && customerData) {
          const eventData = {
            title: title,
            user_surname: title, // Use title as user_surname instead of user_number
            user_number: user_number,
            social_network_link: social_network_link, // This contains the email address
            event_notes: event_notes, // Ensure event_notes is included
            payment_status: payment_status,
            payment_amount: payment_amount ? parseFloat(payment_amount) : null,
            user_id: user.id,
            start_date: eventStartDate.toISOString(),
            end_date: eventEndDate.toISOString(),
          };

          console.log("Creating event from customer:", eventData);

          const { data: eventResult, error: eventError } = await supabase
            .from('events')
            .insert(eventData)
            .select()
            .single();

          if (eventError) {
            console.error("Error creating event:", eventError);
            toast({
              title: t("common.warning"),
              description: t("crm.eventCreationFailed"),
              variant: "destructive"
            });
          } else {
            console.log("Event created successfully:", eventResult);
            
            // Send email notification to customer's email when creating a new event
            if (social_network_link && isValidEmail(social_network_link)) {
              await sendEventCreationEmail({
                id: eventResult.id,
                title: title,
                user_surname: title,
                social_network_link: social_network_link,
                start_date: eventStartDate.toISOString(),
                end_date: eventEndDate.toISOString(),
                payment_status: payment_status,
                payment_amount: payment_amount ? parseFloat(payment_amount) : null,
                event_notes: event_notes // Explicitly include event notes
              });
            }
            
            // If we have a file, also associate it with the new event
            if (uploadedFileData && eventResult) {
              try {
                // Download the file from customer_attachments
                const { data: fileData, error: fetchError } = await supabase.storage
                  .from('customer_attachments')
                  .download(uploadedFileData.file_path);
                  
                if (fetchError) {
                  console.error("Error downloading file for copying:", fetchError);
                  throw fetchError;
                }
                
                // Create a new path for the event file
                const newFilePath = `${eventResult.id}/${uploadedFileData.filename}`;
                
                // Upload the file to the event_attachments bucket
                const { error: uploadError } = await supabase.storage
                  .from('event_attachments')
                  .upload(newFilePath, fileData);
                  
                if (uploadError) {
                  console.error("Error uploading file to event bucket:", uploadError);
                  throw uploadError;
                }
                
                // Create the event_files record with proper information
                const eventFileData = {
                  event_id: eventResult.id,
                  filename: uploadedFileData.filename,
                  file_path: newFilePath,
                  content_type: uploadedFileData.content_type,
                  size: uploadedFileData.size,
                  user_id: user.id
                };
                
                console.log("Creating event file record:", eventFileData);
                
                const { error: eventFileError } = await supabase
                  .from('event_files')
                  .insert(eventFileData);
                  
                if (eventFileError) {
                  console.error("Error associating file with event:", eventFileError);
                } else {
                  console.log("File associated with event successfully");
                }
              } catch (fileAssociationError) {
                console.error("Error associating file with event:", fileAssociationError);
              }
            }
          }
        }
      }

      // Make sure to invalidate all the relevant queries
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });

      toast({
        title: t("common.success"),
        description: customerId ? t("crm.customerUpdated") : t("crm.customerCreated")
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
