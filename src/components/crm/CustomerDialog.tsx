import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

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
  const [isEventData, setIsEventData] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!customerId || !user) {
        resetForm();
        return;
      }
      
      try {
        setLoading(true);
        console.log('Fetching customer with ID:', customerId);
        
        // First try to fetch from events table
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', customerId)
          .maybeSingle();
          
        if (eventError) {
          console.error('Error fetching event:', eventError);
          throw eventError;
        }

        // If not found in events, try to fetch from customers table
        if (!eventData) {
          console.log('Event not found, checking customers table...');
          const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .maybeSingle();
            
          if (customerError) {
            console.error('Error fetching customer:', customerError);
            throw customerError;
          }

          if (customerData) {
            console.log('Found customer data:', customerData);
            setTitle(customerData.title || "");
            setUserSurname(customerData.user_surname || "");
            setUserNumber(customerData.user_number || "");
            setSocialNetworkLink(customerData.social_network_link || "");
            setEventNotes(customerData.event_notes || "");
            setStartDate(customerData.start_date || "");
            setEndDate(customerData.end_date || "");
            setPaymentStatus(customerData.payment_status || "");
            setPaymentAmount(customerData.payment_amount?.toString() || "");
            setCreateEvent(!!customerData.start_date);
            setIsEventData(false);
          }
        } else {
          setIsEventData(true);
          console.log('Found event data:', eventData);
          setTitle(eventData.title || "");
          setUserSurname(eventData.user_surname || "");
          setUserNumber(eventData.user_number || "");
          setSocialNetworkLink(eventData.social_network_link || "");
          setEventNotes(eventData.event_notes || "");
          setStartDate(eventData.start_date || "");
          setEndDate(eventData.end_date || "");
          setPaymentStatus(eventData.payment_status || "");
          setPaymentAmount(eventData.payment_amount?.toString() || "");
          setCreateEvent(true);
        }
        
        if (!eventData && !customerData) {
          console.log('No customer or event found with ID:', customerId);
          toast({
            title: "Not Found",
            description: "Customer not found in either customers or events",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error('Unexpected error:', error);
        toast({
          title: "Error",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchCustomer();
    }
  }, [customerId, isOpen, toast, user]);

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
    setIsEventData(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to perform this action",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const customerData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        start_date: createEvent ? startDate : null,
        end_date: createEvent ? endDate : null,
        payment_status: paymentStatus || null,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        user_id: user.id
      };

      let updatedCustomerId;
      if (customerId) {
        // Update existing customer
        const { data, error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customerId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        updatedCustomerId = data.id;
      } else {
        // Create new customer
        const { data, error } = await supabase
          .from('customers')
          .insert([customerData])
          .select()
          .single();

        if (error) throw error;
        updatedCustomerId = data.id;
      }

      // Handle file upload if a file is selected
      if (selectedFile && updatedCustomerId) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('customer_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const tableName = isEventData ? 'event_files' : 'customer_files_new';
        const columnName = isEventData ? 'event_id' : 'customer_id';

        const { error: fileRecordError } = await supabase
          .from(tableName)
          .insert({
            [columnName]: updatedCustomerId,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id
          });

        if (fileRecordError) throw fileRecordError;
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      toast({
        title: "Success",
        description: customerId ? "Customer updated successfully" : "Customer created successfully",
      });
      
      handleClose();
    } catch (error: any) {
      console.error('Error saving customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
        
        <form onSubmit={handleSubmit}>
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
            isEventData={isEventData}
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : (customerId ? "Update" : "Create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};