import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<any>;
  onDelete?: () => void;
  customer?: any;
  event?: any;
}

export const CustomerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  customer,
  event,
}: CustomerDialogProps) => {
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [createEvent, setCreateEvent] = useState(false);
  const [resultId, setResultId] = useState<string | undefined>(customer?.id);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEventCustomer = customer?.id?.startsWith('event-');
  const eventId = isEventCustomer ? customer?.id?.replace('event-', '') : null;

  useEffect(() => {
    if (customer || event) {
      console.log('Loading customer/event data:', { customer, event });
      const data = customer || event;
      setTitle(data?.title || "");
      setUserSurname(data?.user_surname || "");
      setUserNumber(data?.user_number || "");
      setSocialNetworkLink(data?.social_network_link || "");
      setEventNotes(data?.event_notes || "");
      setPaymentStatus(data?.payment_status || "");
      setPaymentAmount(data?.payment_amount?.toString() || "");
      setCreateEvent(!!data?.start_date && !!data?.end_date);
      setResultId(data?.id);
      
      if (data?.start_date) {
        const formattedStartDate = new Date(data.start_date)
          .toISOString()
          .slice(0, 16);
        setStartDate(formattedStartDate);
      }
      if (data?.end_date) {
        const formattedEndDate = new Date(data.end_date)
          .toISOString()
          .slice(0, 16);
        setEndDate(formattedEndDate);
      }
    }
  }, [customer, event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      console.error('No user ID found');
      toast({
        title: "Error",
        description: "User authentication required",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Starting submission process...', { isEventCustomer, eventId });

      const baseData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        payment_status: paymentStatus || null,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        user_id: user.id,
        type: 'customer'
      };

      const customerData = createEvent ? {
        ...baseData,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString()
      } : baseData;

      let result;

      if (isEventCustomer) {
        console.log('Updating event customer:', eventId);
        const { data: updatedEvent, error: updateError } = await supabase
          .from('events')
          .update(customerData)
          .eq('id', eventId)
          .eq('user_id', user.id)
          .select()
          .maybeSingle();

        if (updateError) {
          console.error('Error updating event:', updateError);
          throw updateError;
        }
        if (!updatedEvent) {
          throw new Error('Event not found or you do not have permission to update it');
        }
        
        result = { ...updatedEvent, id: `event-${updatedEvent.id}` };
        console.log('Updated event result:', result);
      } else if (resultId) {
        console.log('Updating customer:', resultId);
        const { data: updatedCustomer, error: updateError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', resultId)
          .eq('user_id', user.id)
          .select()
          .maybeSingle();

        if (updateError) {
          console.error('Error updating customer:', updateError);
          throw updateError;
        }
        if (!updatedCustomer) {
          throw new Error('Customer not found or you do not have permission to update it');
        }
        
        result = updatedCustomer;
        console.log('Updated customer result:', result);
      } else {
        console.log('Creating new customer');
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert([customerData])
          .select()
          .maybeSingle();
          
        if (createError) {
          console.error('Error creating customer:', createError);
          throw createError;
        }
        if (!newCustomer) {
          throw new Error('Failed to create customer - no data returned');
        }

        result = newCustomer;
        setResultId(newCustomer.id);
        console.log('Created new customer:', result);
      }

      if (selectedFile) {
        const targetId = isEventCustomer ? eventId : result.id;
        const bucketName = isEventCustomer ? 'event_attachments' : 'customer_attachments';
        const tableName = isEventCustomer ? 'event_files' : 'customer_files_new';
        const idField = isEventCustomer ? 'event_id' : 'customer_id';
        
        console.log('Uploading file for:', { targetId, bucketName, tableName, idField });
        
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${crypto.randomUUID()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }

          const fileData = {
            [idField]: targetId,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id
          };

          const { error: fileRecordError } = await supabase
            .from(tableName)
            .insert([fileData]);

          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
            throw fileRecordError;
          }

          console.log('File uploaded successfully');
          
          await queryClient.invalidateQueries({ queryKey: ['customerFiles', result.id] });
          if (eventId) {
            await queryClient.invalidateQueries({ queryKey: ['eventFiles', eventId] });
          }
          
          setSelectedFile(null);
        } catch (fileError: any) {
          console.error('Error handling file:', fileError);
          toast({
            title: "Warning",
            description: "Customer saved but file upload failed. Please try uploading the file again.",
            variant: "destructive",
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      toast({
        title: "Success",
        description: customer ? "Customer updated successfully" : "Customer created successfully",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error handling customer submission:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save customer",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{customer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
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
            eventNotes={eventNotes}
            setEventNotes={setEventNotes}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            customerId={isEventCustomer ? eventId : resultId}
            createEvent={createEvent}
            setCreateEvent={setCreateEvent}
          />
          
          <div className="flex justify-between gap-4">
            <Button type="submit" className="flex-1">
              {customer ? "Update Customer" : "Create Customer"}
            </Button>
            {customer && onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};