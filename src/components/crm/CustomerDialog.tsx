
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const [associatedEventId, setAssociatedEventId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!customerId || !user) {
        resetForm();
        return;
      }
      
      try {
        setLoading(true);
        
        // First, try to find any associated event, using maybeSingle() instead of single()
        const { data: existingEvent, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('title', title)
          .gte('start_date', new Date().toISOString())
          .maybeSingle();

        if (eventError && eventError.code !== 'PGRST116') {
          console.error('Error fetching event:', eventError);
          throw eventError;
        }

        if (existingEvent) {
          setAssociatedEventId(existingEvent.id);
        }

        // Fetch customer data, using maybeSingle() instead of single()
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .maybeSingle();

        if (customerError && customerError.code !== 'PGRST116') {
          console.error('Error fetching customer:', customerError);
          throw customerError;
        }

        if (!customerData) {
          toast({
            title: "Error",
            description: "Customer not found",
            variant: "destructive",
          });
          onClose();
          return;
        }

        setTitle(customerData.title || "");
        setUserSurname(customerData.user_surname || "");
        setUserNumber(customerData.user_number || "");
        setSocialNetworkLink(customerData.social_network_link || "");
        setEventNotes(customerData.event_notes || "");
        setStartDate(customerData.start_date ? new Date(customerData.start_date).toISOString().slice(0, 16) : "");
        setEndDate(customerData.end_date ? new Date(customerData.end_date).toISOString().slice(0, 16) : "");
        setPaymentStatus(customerData.payment_status || "");
        setPaymentAmount(customerData.payment_amount?.toString() || "");
        setCreateEvent(!!customerData.start_date && !!customerData.end_date);

      } catch (error: any) {
        console.error('Error fetching customer:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to load customer data",
          variant: "destructive",
        });
        onClose();
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && customerId) {
      fetchCustomer();
    }
  }, [customerId, isOpen, user, title]);

  const checkTimeSlotAvailability = async (startDate: string, endDate: string, excludeEventId?: string): Promise<boolean> => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const { data: existingEvents, error } = await supabase
      .from('events')
      .select('*')
      .or(`start_date.lte.${end.toISOString()},end_date.gte.${start.toISOString()}`);

    if (error) {
      console.error('Error checking time slot availability:', error);
      return false;
    }

    if (!existingEvents) return true;

    return !existingEvents.some(event => {
      if (excludeEventId && event.id === excludeEventId) return false;
      
      const eventStart = parseISO(event.start_date);
      const eventEnd = parseISO(event.end_date);
      
      return (start < eventEnd && end > eventStart);
    });
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

      if (createEvent) {
        const isTimeSlotAvailable = await checkTimeSlotAvailability(
          startDate,
          endDate,
          associatedEventId || undefined
        );

        if (!isTimeSlotAvailable) {
          toast({
            title: "Error",
            description: "This time slot is already booked",
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
        start_date: createEvent ? startDate : null,
        end_date: createEvent ? endDate : null,
      };

      if (customerId) {
        // Update customer
        const { error: customerError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customerId);

        if (customerError) throw customerError;

        // Handle associated event
        if (createEvent) {
          const eventData = {
            ...customerData,
            type: 'customer_event'
          };

          if (associatedEventId) {
            // Update existing event
            const { error: eventError } = await supabase
              .from('events')
              .update(eventData)
              .eq('id', associatedEventId);

            if (eventError) throw eventError;
          } else {
            // Create new event only if there isn't an existing one
            const { error: eventError } = await supabase
              .from('events')
              .insert([eventData]);

            if (eventError) throw eventError;
          }
        }
      } else {
        // Create new customer
        const { error: customerError } = await supabase
          .from('customers')
          .insert([customerData]);

        if (customerError) throw customerError;

        // Create new event if needed
        if (createEvent) {
          const eventData = {
            ...customerData,
            type: 'customer_event'
          };

          const { error: eventError } = await supabase
            .from('events')
            .insert([eventData]);

          if (eventError) throw eventError;
        }
      }

      // Handle file upload if a file is selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('customer_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const fileData = {
          filename: selectedFile.name,
          file_path: filePath,
          content_type: selectedFile.type,
          size: selectedFile.size,
          user_id: user.id,
          customer_id: customerId
        };

        const { error: fileError } = await supabase
          .from('customer_files_new')
          .insert([fileData]);

        if (fileError) throw fileError;
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      toast({
        title: "Success",
        description: customerId ? "Customer updated successfully" : "Customer created successfully",
      });

      onClose();
    } catch (error: any) {
      console.error('Error handling customer submission:', error);
      toast({
        title: "Error",
        description: error.message,
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
    setAssociatedEventId(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {customerId ? t("crm.editCustomer") : t("crm.newCustomer")}
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
            isOpen={isOpen}
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              {t("crm.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "..." : (customerId ? t("crm.update") : t("crm.create"))}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
