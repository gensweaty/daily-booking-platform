import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarEventType } from "@/lib/types/calendar";
import { Customer } from "@/lib/types/customer";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { CustomerDialogFields } from "./CustomerDialogFields";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onSubmit: (data: Partial<Customer>) => Promise<Customer>;
  onDelete?: () => void;
  customer?: Customer;
}

export const CustomerDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  onDelete,
  customer
}: CustomerDialogProps) => {
  const [title, setTitle] = useState(customer?.title || "");
  const [userSurname, setUserSurname] = useState(customer?.user_surname || "");
  const [userNumber, setUserNumber] = useState(customer?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(customer?.social_network_link || "");
  const [createEvent, setCreateEvent] = useState(customer?.create_event !== undefined ? customer.create_event : false);
  const [paymentStatus, setPaymentStatus] = useState(customer?.payment_status || "not_paid");
  const [paymentAmount, setPaymentAmount] = useState(customer?.payment_amount?.toString() || "");
  const [customerNotes, setCustomerNotes] = useState(customer?.customer_notes || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [startDate, setStartDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : "");
  const [endDate, setEndDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : "");
  const [eventStartDate, setEventStartDate] = useState(selectedDate || new Date());
  const [eventEndDate, setEventEndDate] = useState(() => {
    const initialEndDate = selectedDate ? new Date(selectedDate) : new Date();
    initialEndDate.setHours(initialEndDate.getHours() + 1);
    return initialEndDate;
  });
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  useEffect(() => {
    if (customer) {
      setTitle(customer.title || "");
      setUserSurname(customer.user_surname || "");
      setUserNumber(customer.user_number || "");
      setSocialNetworkLink(customer.social_network_link || "");
      setCreateEvent(customer.create_event !== undefined ? customer.create_event : false);
      setPaymentStatus(customer.payment_status || "not_paid");
      setPaymentAmount(customer.payment_amount?.toString() || "");
      setCustomerNotes(customer.customer_notes || "");

      if (customer.start_date && customer.end_date) {
        setStartDate(format(new Date(customer.start_date), "yyyy-MM-dd'T'HH:mm"));
        setEndDate(format(new Date(customer.end_date), "yyyy-MM-dd'T'HH:mm"));
        setEventStartDate(new Date(customer.start_date));
        setEventEndDate(new Date(customer.end_date));
      }
    } else if (selectedDate) {
      setStartDate(format(selectedDate, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(selectedDate, "yyyy-MM-dd'T'HH:mm"));
      setEventStartDate(selectedDate);
      const initialEndDate = new Date(selectedDate);
      initialEndDate.setHours(initialEndDate.getHours() + 1);
      setEventEndDate(initialEndDate);
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setCreateEvent(false);
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setCustomerNotes("");
    }
  }, [customer, selectedDate]);

  // Handle form submission for creating/updating customer
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || title.trim() === "") {
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "crm.fullNameRequired"
        },
        variant: "destructive",
      });
      return;
    }

    try {
      const customerData: Partial<Customer> = {
        title: title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        customer_notes: customerNotes,
        create_event: createEvent,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
      };

      if (customer?.id) {
        customerData.id = customer.id;
      }

      console.log("CustomerDialog - Submitting customer data:", customerData);
      const createdCustomer = await onSubmit(customerData);
      console.log('Created/Updated customer:', createdCustomer);
      
      // Store the newly uploaded file for later use with event creation
      let uploadedFilePath = null;
      let uploadedFilename = null;
      let uploadedContentType = null;
      let uploadedFileSize = null;

      // Handle file upload if there's a selected file
      if (selectedFile && createdCustomer?.id && user) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${createdCustomer.id}/${crypto.randomUUID()}.${fileExt}`;
          
          console.log('Uploading file to customer_attachments:', filePath);
          
          const { error: uploadError } = await supabase.storage
            .from('customer_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }

          // Save file details for potential event creation
          uploadedFilePath = filePath;
          uploadedFilename = selectedFile.name;
          uploadedContentType = selectedFile.type;
          uploadedFileSize = selectedFile.size;

          // Create record in customer_files_new table
          const fileData = {
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id,
            customer_id: createdCustomer.id
          };

          const { error: fileRecordError } = await supabase
            .from('customer_files_new')
            .insert(fileData);
            
          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
            throw fileRecordError;
          }

          console.log('File record created successfully for customer');
        } catch (fileError) {
          console.error("Error handling file upload:", fileError);
          // Continue with form submission even if file upload fails
        }
      }

      // If the user has opted to create an event for this customer
      if (createEvent) {
        try {
          console.log("Creating event for customer:", createdCustomer);
          
          const startDateTime = new Date(eventStartDate);
          const endDateTime = new Date(eventEndDate);
          
          const eventData: Partial<CalendarEventType> = {
            title: title,
            user_surname: title, // Sync the title with the user_surname for consistency
            user_number: userNumber,
            social_network_link: socialNetworkLink,
            event_notes: customerNotes, // Use customer notes for event notes
            start_date: startDateTime.toISOString(),
            end_date: endDateTime.toISOString(),
            payment_status: paymentStatus,
            payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
            type: 'event',
          };
          
          // Pass the event data for creation
          const { data: createdEvent, error: eventError } = await supabase
            .from('events')
            .insert({
              ...eventData,
              user_id: user?.id
            })
            .select('*')
            .single();
            
          if (eventError) {
            console.error('Error creating event:', eventError);
            throw eventError;
          }
          
          console.log('Event created successfully:', createdEvent);

          // If we have uploaded a file for the customer, also associate it with the event
          if (uploadedFilePath && createdEvent && user) {
            try {
              // Create a new unique file path for the event attachment
              const fileExt = uploadedFilePath.split('.').pop();
              const eventFilePath = `${createdEvent.id}/${crypto.randomUUID()}.${fileExt}`;
              
              // Copy the file from customer_attachments to event_attachments
              console.log('Copying file from customer_attachments to event_attachments');
              console.log('Source:', uploadedFilePath);
              console.log('Destination:', eventFilePath);
              
              // Get the file data from the customer bucket
              const { data: fileData, error: downloadError } = await supabase.storage
                .from('customer_attachments')
                .download(uploadedFilePath);
                
              if (downloadError) {
                console.error('Error downloading file from customer_attachments:', downloadError);
                throw downloadError;
              }
              
              // Upload the file to the event bucket
              const { error: uploadError } = await supabase.storage
                .from('event_attachments')
                .upload(eventFilePath, fileData);
                
              if (uploadError) {
                console.error('Error uploading file to event_attachments:', uploadError);
                throw uploadError;
              }
              
              // Create record in event_files table
              const eventFileData = {
                filename: uploadedFilename,
                file_path: eventFilePath,
                content_type: uploadedContentType,
                size: uploadedFileSize,
                user_id: user.id,
                event_id: createdEvent.id
              };
              
              const { error: fileRecordError } = await supabase
                .from('event_files')
                .insert(eventFileData);
                
              if (fileRecordError) {
                console.error('Error creating event file record:', fileRecordError);
                throw fileRecordError;
              }
              
              console.log('File successfully associated with both customer and event');
            } catch (fileError) {
              console.error("Error handling event file upload:", fileError);
              // Continue even if file association fails
            }
          }
          
          // Invalidate relevant queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['events'] });
        } catch (eventError) {
          console.error('Error in event creation flow:', eventError);
          toast({
            translateKeys: {
              titleKey: "common.warning",
              descriptionKey: "crm.eventCreationError"
            },
            variant: "destructive"
          });
        }
      }
      
      // Standard success toast and dialog closing
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: customer?.id ? "crm.customerUpdated" : "crm.customerCreated"
        }
      });
      
      onOpenChange(false);
      
      // Invalidate queries to ensure data is refreshed
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
    } catch (error: any) {
      console.error('Error handling customer submission:', error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        },
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{customer ? t("crm.editCustomer") : t("crm.addCustomer")}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <CustomerDialogFields
            title={title}
            setTitle={setTitle}
            userSurname={userSurname}
            setUserSurname={setUserSurname}
            userNumber={userNumber}
            setUserNumber={setUserNumber}
            socialNetworkLink={socialNetworkLink}
            setSocialNetworkLink={setSocialNetworkLink}
            createEvent={createEvent}
            setCreateEvent={setCreateEvent}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            customerNotes={customerNotes}
            setCustomerNotes={setCustomerNotes}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            isEventBased={!!customer?.start_date && !!customer?.end_date}
            startDate={customer?.start_date}
            endDate={customer?.end_date}
            customerId={customer?.id}
            eventStartDate={eventStartDate}
            setEventStartDate={setEventStartDate}
            eventEndDate={eventEndDate}
            setEventEndDate={setEventEndDate}
          />
          <div className="flex justify-between">
            <Button type="submit">{customer ? t("crm.updateCustomer") : t("crm.createCustomer")}</Button>
            {customer && onDelete && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                {t("common.delete")}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDialog;
