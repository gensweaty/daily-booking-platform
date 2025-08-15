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
import { sendBookingConfirmationEmail, sendBookingConfirmationToMultipleRecipients } from "@/lib/api";
import { useSubUserPermissions } from "@/hooks/useSubUserPermissions";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string | null;
  initialData?: any;
  isPublicMode?: boolean;
  externalUserName?: string;
  externalUserEmail?: string;
  publicBoardUserId?: string;
}

export const CustomerDialog = ({
  open,
  onOpenChange,
  customerId,
  initialData,
  isPublicMode = false,
  externalUserName,
  externalUserEmail,
  publicBoardUserId,
}: CustomerDialogProps) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isSubUser } = useSubUserPermissions();
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
      
      setCreateEvent(initialData.create_event || false);
      
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

  const copyFileFromCustomerToEvent = async (eventId: string, uploadedFileData: any) => {
    try {
      console.log("Starting file copy from customer to event storage");
      
      const { data: fileData, error: fetchError } = await supabase.storage
        .from('customer_attachments')
        .download(uploadedFileData.file_path);
        
      if (fetchError) {
        console.error("Error downloading file for copying:", fetchError);
        throw fetchError;
      }
      
      const newFilePath = `${eventId}/${uploadedFileData.filename}`;
      
      const { error: uploadError } = await supabase.storage
        .from('event_attachments')
        .upload(newFilePath, fileData);
        
      if (uploadError) {
        console.error("Error uploading file to event bucket:", uploadError);
        throw uploadError;
      }
      
      const eventFileData = {
        event_id: eventId,
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
      console.error("Error copying file from customer to event:", fileAssociationError);
    }
  };

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

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const sendEventCreationEmail = async (eventData: any, additionalPersons: any[] = []) => {
    try {
      console.log(`🔔 Starting email notification process for event: ${eventData.title || eventData.user_surname}`);
      
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

      const recipients: Array<{ email: string; name: string }> = [];
      
      const mainCustomerEmail = eventData.social_network_link;
      if (mainCustomerEmail && isValidEmail(mainCustomerEmail)) {
        recipients.push({
          email: mainCustomerEmail,
          name: eventData.title || eventData.user_surname || ''
        });
      }
      
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
      
      console.log(`📧 Found ${recipients.length} recipients for email notifications with language: ${language}`);
      
      if (recipients.length === 1) {
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
          eventData.event_notes || ''
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
          eventData.event_notes || ''
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
    }
  };

  // Helper function to get the effective user ID for operations
  const getEffectiveUserId = () => {
    if (isPublicMode && publicBoardUserId) {
      return publicBoardUserId;
    }
    return user?.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveUserId = getEffectiveUserId();

    if (!effectiveUserId || effectiveUserId === 'temp-public-user') {
      toast({
        title: t("common.error"),
        description: isPublicMode ? "Board owner authentication required" : t("common.missingUserInfo"),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { title, user_number, social_network_link, event_notes, payment_status, payment_amount } = formData;

      if (customerId) {
        const updates = {
          title,
          user_number,
          social_network_link,
          event_notes,
          payment_status,
          payment_amount: payment_amount ? parseFloat(payment_amount) : null,
          user_id: effectiveUserId,
          create_event: createEvent,
          start_date: createEvent ? eventStartDate.toISOString() : null,
          end_date: createEvent ? eventEndDate.toISOString() : null,
          // Add edit metadata for sub-users
          ...(isPublicMode && externalUserName ? {
            last_edited_by_type: 'sub_user',
            last_edited_by_name: externalUserName,
            last_edited_at: new Date().toISOString()
          } : isSubUser ? {
            last_edited_by_type: 'sub_user',
            last_edited_by_name: user?.email || 'sub_user',
            last_edited_at: new Date().toISOString()
          } : {})
        };

        let tableToUpdate = 'customers';
        let id = customerId;

        if (customerId.startsWith('event-')) {
          tableToUpdate = 'events';
          id = customerId.replace('event-', '');
        }

        // Log data for debugging
        console.log('🔍 CustomerDialog update data:', {
          customerId,
          isPublicMode,
          externalUserName,
          publicBoardUserId,
          updates
        });

        // For public mode (sub-users), use simplified ownership logic
        let query = supabase
          .from(tableToUpdate)
          .update(updates)
          .eq('id', id);
        
        if (isPublicMode && publicBoardUserId) {
          // In public mode, always filter by board owner's user_id
          query = query.eq('user_id', publicBoardUserId);
        } else {
          query = query.eq('user_id', effectiveUserId);
        }
        
        const { data, error } = await query
          .select()
          .single();

        if (error) throw error;

        let uploadedFileData = null;
        if (selectedFile && customerId && !customerId.startsWith('event-')) {
          try {
            uploadedFileData = await uploadFile(customerId, selectedFile);
            console.log("File uploaded for customer:", uploadedFileData);
          } catch (uploadError) {
            console.error("File upload failed:", uploadError);
          }
        }

        if (tableToUpdate === 'customers' && createEvent) {
          const { data: existingEvents, error: eventCheckError } = await supabase
            .from('events')
            .select('id')
            .eq('title', title)
            .eq('user_id', effectiveUserId)
            .is('deleted_at', null);
            
          if (eventCheckError) {
            console.error("Error checking for existing events:", eventCheckError);
          }
          
          const eventData = {
            title: title,
            user_surname: title,
            user_number: user_number,
            social_network_link: social_network_link,
            event_notes: event_notes,
            payment_status: payment_status,
            payment_amount: payment_amount ? parseFloat(payment_amount) : null,
            user_id: effectiveUserId,
            start_date: eventStartDate.toISOString(),
            end_date: eventEndDate.toISOString(),
          };

          let createdEventId: string | null = null;

          if (existingEvents && existingEvents.length > 0) {
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
              
              await sendEventCreationEmail({
                ...updatedEvent,
                event_notes: event_notes
              }, []);
            }
          } else {
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
              
              await sendEventCreationEmail({
                ...newEvent,
                event_notes: event_notes
              }, []);
            }
          }

          if (uploadedFileData && createdEventId) {
            await copyFileFromCustomerToEvent(createdEventId, uploadedFileData);
          }
        }
      } else {
        const newCustomer = {
          title,
          user_number,
          social_network_link,
          event_notes,
          payment_status,
          payment_amount: payment_amount ? parseFloat(payment_amount) : null,
          user_id: effectiveUserId,
          create_event: createEvent,
          start_date: createEvent ? eventStartDate.toISOString() : null,
          end_date: createEvent ? eventEndDate.toISOString() : null,
          // Add creator metadata for sub-users
          ...(isPublicMode && externalUserName ? {
            created_by_type: 'sub_user',
            created_by_name: externalUserName,
            last_edited_by_type: 'sub_user',
            last_edited_by_name: externalUserName
          } : isSubUser ? {
            created_by_type: 'sub_user',
            created_by_name: user?.email || 'sub_user',
            last_edited_by_type: 'sub_user',
            last_edited_by_name: user?.email || 'sub_user'
          } : {})
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

        let uploadedFileData = null;
        if (selectedFile && customerData) {
          try {
            uploadedFileData = await uploadFile(customerData.id, selectedFile);
            console.log("File uploaded for customer:", uploadedFileData);
          } catch (uploadError) {
            console.error("File upload failed:", uploadError);
          }
        }

        if (createEvent && customerData) {
          const eventData = {
            title: title,
            user_surname: title,
            user_number: user_number,
            social_network_link: social_network_link,
            event_notes: event_notes,
            payment_status: payment_status,
            payment_amount: payment_amount ? parseFloat(payment_amount) : null,
            user_id: effectiveUserId,
            start_date: eventStartDate.toISOString(),
            end_date: eventEndDate.toISOString(),
            // Add metadata for sub-users when creating events from customers
            ...(isPublicMode && externalUserName ? {
              created_by_type: 'sub_user',
              created_by_name: externalUserName,
              last_edited_by_type: 'sub_user',
              last_edited_by_name: externalUserName
            } : isSubUser ? {
              created_by_type: 'sub_user',
              created_by_name: user?.email || 'sub_user',
              last_edited_by_type: 'sub_user',
              last_edited_by_name: user?.email || 'sub_user'
            } : {})
          };

          console.log("Creating event from customer with payment status:", eventData.payment_status);

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
            console.log("Event created successfully with payment status:", eventResult.payment_status);
            
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
                event_notes: event_notes
              });
            }
            
            if (uploadedFileData && eventResult) {
              await copyFileFromCustomerToEvent(eventResult.id, uploadedFileData);
            }
          }
        }
      }

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
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    const effectiveUserId = getEffectiveUserId();
    if (!customerId || !effectiveUserId || effectiveUserId === 'temp-public-user') return;

    try {
      setIsLoading(true);

      let tableToUpdate = 'customers';
      let id = customerId;

      if (customerId.startsWith('event-')) {
        tableToUpdate = 'events';
        id = customerId.replace('event-', '');
      }

      // Log data for debugging
      console.log('🔍 CustomerDialog delete data:', {
        customerId: id,
        isPublicMode,
        externalUserName,
        publicBoardUserId
      });

      // For public mode (sub-users), use simplified ownership logic
      let query = supabase
        .from(tableToUpdate)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      
      if (isPublicMode && publicBoardUserId) {
        // In public mode, always filter by board owner's user_id
        query = query.eq('user_id', publicBoardUserId);
      } else {
        query = query.eq('user_id', effectiveUserId);
      }

      const { error } = await query;

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

  // Permission check functions for sub-users
  const canEditCustomer = () => {
    // Allow creation of new customers
    if (!customerId) return true;
    
    // In public mode (sub-users), check if they created this customer
    if (isPublicMode && externalUserName) {
      return (
        initialData?.created_by_type === 'sub_user' && 
        initialData?.created_by_name === externalUserName
      ) || (
        // Also allow if they were the last to edit it
        initialData?.last_edited_by_type === 'sub_user' &&
        initialData?.last_edited_by_name === externalUserName
      ) || (
        // Allow if no metadata (legacy data)
        !initialData?.created_by_type && !initialData?.created_by_name
      );
    }
    
    // For authenticated sub-users
    if (isSubUser && user?.email) {
      return (
        initialData?.created_by_type === 'sub_user' && 
        initialData?.created_by_name === user.email
      ) || (
        // Also allow if they were the last to edit it
        initialData?.last_edited_by_type === 'sub_user' &&
        initialData?.last_edited_by_name === user.email
      ) || (
        // Allow if no metadata (legacy data)
        !initialData?.created_by_type && !initialData?.created_by_name
      );
    }
    
    // Main users can edit all customers they own
    return true;
  };

  const canDeleteCustomer = () => {
    // Don't allow deletion of new customers (no customerId yet)
    if (!customerId) return false;
    
    // In public mode (sub-users), check if they created this customer
    if (isPublicMode && externalUserName) {
      return (
        initialData?.created_by_type === 'sub_user' && 
        initialData?.created_by_name === externalUserName
      ) || (
        // Allow if no metadata (legacy data)
        !initialData?.created_by_type && !initialData?.created_by_name
      );
    }
    
    // For authenticated sub-users
    if (isSubUser && user?.email) {
      return (
        initialData?.created_by_type === 'sub_user' && 
        initialData?.created_by_name === user.email
      ) || (
        // Allow if no metadata (legacy data)
        !initialData?.created_by_type && !initialData?.created_by_name
      );
    }
    
    // Main users can delete all customers they own
    return true;
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
              initialData={initialData}
              currentUserName={externalUserName}
              currentUserType={isPublicMode && externalUserName ? 'sub_user' : 'admin'}
              isSubUser={isSubUser || (isPublicMode && !!externalUserName)}
            />

            {/* Action Buttons with Permissions */}
            <div className="flex justify-between">
              {/* Update Button */}
              {canEditCustomer() ? (
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 mr-2"
                >
                  {customerId ? t("common.update") : t("common.add")}
                </Button>
              ) : customerId ? (
                <Button
                  type="submit"
                  disabled={true}
                  className="flex-1 mr-2"
                >
                  {t("common.update")}
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 mr-2"
                >
                  {t("common.add")}
                </Button>
              )}
              
              {/* Delete Button */}
              {customerId && canDeleteCustomer() && (
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
              {customerId && !canDeleteCustomer() && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  disabled={true}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Unified Permission Message */}
            {customerId && (!canEditCustomer() || !canDeleteCustomer()) && (
              <div className="mt-2 px-3 py-2 bg-muted/30 rounded-md border border-muted text-center">
                <span className="text-sm text-muted-foreground">
                  {language === 'en' ? "Only the customer creator can edit or delete this customer" : 
                   language === 'es' ? "Solo el creador del cliente puede editar o eliminar este cliente" : 
                   "მხოლოდ მომხმარებლის შემქმნელს შეუძლია ამ მომხმარებლის რედაქტირება ან წაშლა"}
                </span>
              </div>
            )}
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
