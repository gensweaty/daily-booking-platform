import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { parseISO } from "date-fns";
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
  const [isEventData, setIsEventData] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
    } catch (error) {
      console.error('Error formatting date:', error);
      return "";
    }
  };

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
            .eq('user_id', user.id)
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
            setStartDate(formatDateForInput(customerData.start_date));
            setEndDate(formatDateForInput(customerData.end_date));
            setPaymentStatus(customerData.payment_status || "");
            setPaymentAmount(customerData.payment_amount?.toString() || "");
            setCreateEvent(!!customerData.start_date && !!customerData.end_date);
            setIsEventData(false);

            // If customer has an event, fetch and sync with event data
            if (customerData.start_date && customerData.end_date) {
              const { data: linkedEvent } = await supabase
                .from('events')
                .select('*')
                .eq('title', customerData.title)
                .eq('user_id', user.id)
                .maybeSingle();

              if (linkedEvent) {
                // Update event with customer data
                const { error: updateError } = await supabase
                  .from('events')
                  .update({
                    start_date: customerData.start_date,
                    end_date: customerData.end_date,
                    payment_status: customerData.payment_status,
                    payment_amount: customerData.payment_amount,
                    event_notes: customerData.event_notes
                  })
                  .eq('id', linkedEvent.id);

                if (updateError) throw updateError;
              }
            }
          }
        } else {
          setIsEventData(true);
          console.log('Found event data:', eventData);
          setTitle(eventData.title || "");
          setUserSurname(eventData.user_surname || "");
          setUserNumber(eventData.user_number || "");
          setSocialNetworkLink(eventData.social_network_link || "");
          setEventNotes(eventData.event_notes || "");
          setStartDate(formatDateForInput(eventData.start_date));
          setEndDate(formatDateForInput(eventData.end_date));
          setPaymentStatus(eventData.payment_status || "");
          setPaymentAmount(eventData.payment_amount?.toString() || "");
          setCreateEvent(true);

          // Sync customer data with event data
          const { data: linkedCustomer } = await supabase
            .from('customers')
            .select('*')
            .eq('title', eventData.title)
            .eq('user_id', user.id)
            .maybeSingle();

          if (linkedCustomer) {
            // Update customer with event data
            const { error: updateError } = await supabase
              .from('customers')
              .update({
                start_date: eventData.start_date,
                end_date: eventData.end_date,
                payment_status: eventData.payment_status,
                payment_amount: eventData.payment_amount,
                event_notes: eventData.event_notes
              })
              .eq('id', linkedCustomer.id);

            if (updateError) throw updateError;
          }
        }
      } catch (error: any) {
        console.error('Unexpected error:', error);
        toast({
          title: "Error",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        });
        handleClose();
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchCustomer();
    }
  }, [customerId, isOpen, toast, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!user) throw new Error("User must be authenticated");

      // If creating/updating an event, check time slot availability
      if (createEvent) {
        const { available, conflictingEvent } = await checkTimeSlotAvailability(
          startDate,
          endDate,
          isEventData ? customerId : undefined
        );

        if (!available) {
          toast({
            title: "Time Slot Unavailable",
            description: `This time slot conflicts with "${conflictingEvent?.title}" (${new Date(conflictingEvent?.start_date).toLocaleTimeString()} - ${new Date(conflictingEvent?.end_date).toLocaleTimeString()})`,
            variant: "destructive",
          });
          return;
        }
      }

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
      let eventId;
      
      if (customerId) {
        // Update existing customer
        const { data: updatedData, error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customerId)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!updatedData) throw new Error("Failed to update customer");
        updatedCustomerId = updatedData.id;

        // If this is an event, update it instead of creating a new one
        if (isEventData) {
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
          };

          const { error: eventError } = await supabase
            .from('events')
            .update(eventData)
            .eq('id', customerId)
            .eq('user_id', user.id);

          if (eventError) throw eventError;
          eventId = customerId;
        }
        // If createEvent is true and this is not already an event, update or create event
        else if (createEvent) {
          const { data: existingEvent } = await supabase
            .from('events')
            .select('*')
            .eq('title', title)
            .eq('user_id', user.id)
            .maybeSingle();

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
            type: 'customer_event'
          };

          if (existingEvent) {
            // Update existing event
            const { error: eventError } = await supabase
              .from('events')
              .update(eventData)
              .eq('id', existingEvent.id);

            if (eventError) throw eventError;
            eventId = existingEvent.id;
          } else {
            // Create new event
            const { data: newEvent, error: eventError } = await supabase
              .from('events')
              .insert([eventData])
              .select()
              .maybeSingle();

            if (eventError) throw eventError;
            if (newEvent) eventId = newEvent.id;
          }
        }
      } else {
        // Create new customer
        const { data: newData, error } = await supabase
          .from('customers')
          .insert([customerData])
          .select()
          .maybeSingle();

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
            type: 'customer_event'
          };

          const { data: newEvent, error: eventError } = await supabase
            .from('events')
            .insert([eventData])
            .select()
            .maybeSingle();

          if (eventError) throw eventError;
          if (newEvent) eventId = newEvent.id;
        }
      }

      // Handle file upload if a file is selected
      if (selectedFile && updatedCustomerId) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('customer_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { error: fileRecordError } = await supabase
          .from('customer_files_new')
          .insert({
            customer_id: updatedCustomerId,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id
          });

        if (fileRecordError) throw fileRecordError;

        // Invalidate the files query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['customerFiles', updatedCustomerId] });
      }

      // If we have an event ID and a file, upload it to event_files as well
      if (selectedFile && eventId) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { error: fileRecordError } = await supabase
          .from('event_files')
          .insert({
            event_id: eventId,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id
          });

        if (fileRecordError) throw fileRecordError;

        // Invalidate the files query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['customerFiles', eventId] });
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

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

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

  const checkTimeSlotAvailability = async (startDate: string, endDate: string, excludeEventId?: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Query existing events within the time range
    const { data: existingEvents, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user?.id)
      .or(`start_date.lte.${end.toISOString()},end_date.gte.${start.toISOString()}`);

    if (error) {
      console.error('Error checking time slot:', error);
      return { available: false, error: error.message };
    }

    // Check for conflicts
    const conflict = existingEvents?.find(event => {
      if (excludeEventId && event.id === excludeEventId) return false;
      
      const eventStart = parseISO(event.start_date);
      const eventEnd = parseISO(event.end_date);
      
      return (start < eventEnd && end > eventStart);
    });

    return { 
      available: !conflict,
      conflictingEvent: conflict
    };
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
