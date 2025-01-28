import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

interface CustomerDialogProps {
  customerId?: string;
  onClose: () => void;
  isOpen: boolean;
}

const CustomerDialog = ({ customerId, onClose, isOpen }: CustomerDialogProps) => {
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
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!user) throw new Error("User must be authenticated");

      const customerData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        payment_status: paymentStatus || null,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        user_id: user.id,
        type: 'customer',
        start_date: createEvent ? startDate : null,
        end_date: createEvent ? endDate : null,
      };

      let updatedCustomerId;
      
      if (customerId) {
        // Update existing customer
        const { data: updatedData, error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customerId)
          .select()
          .single();

        if (error) throw error;
        if (!updatedData) throw new Error("Failed to update customer");
        updatedCustomerId = updatedData.id;

        // If createEvent is true and this is not already an event, create a new event
        if (createEvent && !isEventData) {
          const eventData = {
            title,
            user_surname: userSurname,
            user_number: userNumber,
            social_network_link: socialNetworkLink,
            event_notes: eventNotes,
            start_date: startDate,
            end_date: endDate,
            payment_status: paymentStatus || null,
            payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
            user_id: user.id,
            type: 'customer_event'  // Make sure type is set correctly
          };

          const { error: eventError } = await supabase
            .from('events')
            .insert([eventData]);

          if (eventError) throw eventError;
        }
      } else {
        // Create new customer
        const { data: newData, error } = await supabase
          .from('customers')
          .insert([customerData])
          .select()
          .single();

        if (error) throw error;
        if (!newData) throw new Error("Failed to create customer");
        updatedCustomerId = newData.id;

        // If createEvent is true, create a new event
        if (createEvent) {
          const eventData = {
            title,
            user_surname: userSurname,
            user_number: userNumber,
            social_network_link: socialNetworkLink,
            event_notes: eventNotes,
            start_date: startDate,
            end_date: endDate,
            payment_status: paymentStatus || null,
            payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
            user_id: user.id,
            type: 'customer_event'  // Make sure type is set correctly
          };

          const { error: eventError } = await supabase
            .from('events')
            .insert([eventData]);

          if (eventError) throw eventError;
        }
      }

      // Handle file uploads if any
      if (selectedFile) {
        // ... handle file upload logic
      }

      toast({
        title: "Success",
        description: `Customer successfully ${customerId ? "updated" : "created"}`,
      });

      onClose();
    } catch (error: any) {
      console.error('Error handling customer submission:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
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
      <button type="submit">Submit</button>
    </form>
  );
};

export default CustomerDialog;
