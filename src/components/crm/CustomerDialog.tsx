import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (customer || event) {
      const data = customer || event;
      setTitle(data?.title || "");
      setUserSurname(data?.user_surname || "");
      setUserNumber(data?.user_number || "");
      setSocialNetworkLink(data?.social_network_link || "");
      setEventNotes(data?.event_notes || "");
      setPaymentStatus(data?.payment_status || "");
      setPaymentAmount(data?.payment_amount?.toString() || "");
      setCreateEvent(!!data?.start_date && !!data?.end_date);
      
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
    
    try {
      const baseData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        payment_status: paymentStatus || null,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        user_id: user?.id,
        type: 'customer'
      };

      const customerData = createEvent ? {
        ...baseData,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString()
      } : baseData;

      let createdCustomer;
      
      if (customer?.id) {
        // Update existing customer
        const { data: updatedCustomer, error: updateError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customer.id)
          .eq('user_id', user?.id)
          .select();

        if (updateError) throw updateError;
        
        createdCustomer = updatedCustomer?.[0];

        // Update corresponding event if it exists
        if (createEvent) {
          const eventData = {
            ...baseData,
            start_date: new Date(startDate).toISOString(),
            end_date: new Date(endDate).toISOString(),
            type: 'private_party'
          };

          const { error: eventError } = await supabase
            .from('events')
            .update(eventData)
            .eq('title', customer.title)
            .eq('user_id', user?.id);

          if (eventError) {
            console.error('Error updating event:', eventError);
            toast({
              title: "Warning",
              description: "Customer updated but event update failed",
              variant: "destructive",
            });
          }
        }

        toast({
          title: "Success",
          description: "Customer updated successfully",
        });
      } else {
        // Create new customer
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert([customerData])
          .select();
          
        if (createError) throw createError;
        createdCustomer = newCustomer?.[0];

        // Create corresponding event if checkbox is checked
        if (createEvent) {
          const eventData = {
            ...baseData,
            start_date: new Date(startDate).toISOString(),
            end_date: new Date(endDate).toISOString(),
            type: 'private_party'
          };

          const { error: eventError } = await supabase
            .from('events')
            .insert([{ ...eventData, user_id: user?.id }]);

          if (eventError) {
            console.error('Error creating event:', eventError);
            toast({
              title: "Warning",
              description: "Customer created but event creation failed",
              variant: "destructive",
            });
          }
        }

        toast({
          title: "Success",
          description: "Customer created successfully",
        });
      }

      // Handle file upload if a file is selected
      if (selectedFile && createdCustomer?.id && user) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('customer_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { error: fileRecordError } = await supabase
          .from('customer_files_new')
          .insert({
            customer_id: createdCustomer.id,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id
          });

        if (fileRecordError) throw fileRecordError;
      }

      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
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
            customerId={customer?.id}
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
