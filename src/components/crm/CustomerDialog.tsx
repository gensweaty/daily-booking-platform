import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

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
      setCreateEvent(!!data?.start_date);
    }
  }, [customer, event]);

  useEffect(() => {
    if (event) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
      setCreateEvent(true);
    } else if (customer?.start_date) {
      const start = new Date(customer.start_date);
      const end = new Date(customer.end_date);
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
      setCreateEvent(true);
    } else {
      const start = new Date();
      const end = new Date();
      end.setHours(start.getHours() + 1);
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [event, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Only create an event if the checkbox is checked
      if (createEvent) {
        const eventData = {
          title,
          user_surname: userSurname,
          user_number: userNumber,
          social_network_link: socialNetworkLink,
          event_notes: eventNotes,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          payment_status: paymentStatus || null,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
          user_id: user?.id,
          type: 'customer'
        };
        const createdCustomer = await onSubmit(eventData);

        if (selectedFile && createdCustomer?.id && user) {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${crypto.randomUUID()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('customer_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) throw uploadError;

          const { error: fileRecordError } = await supabase
            .from('customer_files')
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
      } else {
        // Create a customer without event data
        const customerData = {
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
        await onSubmit(customerData);
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
        description: error.message || "Failed to save customer. Please try again.",
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