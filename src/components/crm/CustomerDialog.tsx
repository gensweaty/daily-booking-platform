import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface CustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
}

export const CustomerDialog = ({ isOpen, onClose, customerId }: CustomerDialogProps) => {
  const [loading, setLoading] = useState(false);
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
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!customerId) {
        resetForm();
        return;
      }
      
      try {
        setLoading(true);
        console.log('Fetching customer with ID:', customerId);
        
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching customer:', error);
          toast({
            title: "Error",
            description: "Failed to fetch customer details",
            variant: "destructive",
          });
          return;
        }
        
        if (data) {
          console.log('Fetched customer data:', data);
          setTitle(data.title || "");
          setUserSurname(data.user_surname || "");
          setUserNumber(data.user_number || "");
          setSocialNetworkLink(data.social_network_link || "");
          setEventNotes(data.event_notes || "");
          setStartDate(data.start_date || "");
          setEndDate(data.end_date || "");
          setPaymentStatus(data.payment_status || "");
          setPaymentAmount(data.payment_amount?.toString() || "");
          setCreateEvent(!!data.start_date);
        } else {
          console.log('No customer found with ID:', customerId);
          toast({
            title: "Not Found",
            description: "Customer not found",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchCustomer();
    }
  }, [customerId, isOpen, toast]);

  const resetForm = () => {
    setTitle("");
    setUserSurname("");
    setUserNumber("");
    setSocialNetworkLink("");
    setEventNotes("");
    setStartDate("");
    setEndDate("");
    setPaymentStatus("");
    setPaymentAmount("");
    setSelectedFile(null);
    setFileError("");
    setCreateEvent(false);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {customerId ? 'Edit Customer' : 'New Customer'}
          </DialogTitle>
        </DialogHeader>
        
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
          customerId={customerId}
          createEvent={createEvent}
          setCreateEvent={setCreateEvent}
        />

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => {}} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};