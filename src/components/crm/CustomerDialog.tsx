import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<any>;
  onDelete?: () => void;
  customer?: any;
}

export const CustomerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  customer,
}: CustomerDialogProps) => {
  const [title, setTitle] = useState(customer?.title || "");
  const [userSurname, setUserSurname] = useState(customer?.user_surname || "");
  const [userNumber, setUserNumber] = useState(customer?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(customer?.social_network_link || "");
  const [eventNotes, setEventNotes] = useState(customer?.event_notes || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(customer?.payment_status || "");
  const [paymentAmount, setPaymentAmount] = useState(customer?.payment_amount?.toString() || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [createEvent, setCreateEvent] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (customer) {
      const start = customer.start_date ? new Date(customer.start_date) : null;
      const end = customer.end_date ? new Date(customer.end_date) : null;
      
      if (start) setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      if (end) setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
      setCreateEvent(!!start && !!end);
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const customerData: any = {
      title,
      user_surname: userSurname,
      user_number: userNumber,
      social_network_link: socialNetworkLink,
      event_notes: eventNotes,
      payment_status: paymentStatus || null,
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
    };

    if (createEvent) {
      customerData.start_date = startDate ? new Date(startDate).toISOString() : null;
      customerData.end_date = endDate ? new Date(endDate).toISOString() : null;
    }

    try {
      const createdCustomer = await onSubmit(customerData);

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
          })
          .select()
          .maybeSingle();

        if (fileRecordError) throw fileRecordError;
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error handling customer submission:', error);
      throw error;
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