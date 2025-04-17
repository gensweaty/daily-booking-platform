
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

  // Only fetch customer data when dialog is opened
  useEffect(() => {
    if (!isOpen || !customerId || !user) {
      if (!isOpen) {
        resetForm();
      }
      return;
    }
    
    const fetchCustomer = async () => {
      try {
        setLoading(true);

        // Check if the customerId starts with 'event-' to know whether we're editing an event or a customer
        if (customerId.startsWith('event-')) {
          const eventId = customerId.replace('event-', '');
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .maybeSingle();

          if (eventError) {
            console.error('Error fetching event:', eventError);
            throw eventError;
          }

          if (!eventData) {
            toast({
              title: t("common.error"),
              description: t("common.notFound"),
              variant: "destructive",
            });
            onClose();
            return;
          }

          setTitle(eventData.title || "");
          setUserSurname(eventData.user_surname || "");
          setUserNumber(eventData.user_number || "");
          setSocialNetworkLink(eventData.social_network_link || "");
          setEventNotes(eventData.event_notes || "");
          setStartDate(eventData.start_date ? new Date(eventData.start_date).toISOString().slice(0, 16) : "");
          setEndDate(eventData.end_date ? new Date(eventData.end_date).toISOString().slice(0, 16) : "");
          setPaymentStatus(eventData.payment_status || "");
          setPaymentAmount(eventData.payment_amount?.toString() || "");
          setCreateEvent(true);
          setIsEventData(true);
          setAssociatedEventId(eventId);
        } else {
          const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .maybeSingle();

          if (customerError) {
            console.error('Error fetching customer:', customerError);
            throw customerError;
          }

          if (!customerData) {
            toast({
              title: t("common.error"),
              description: t("common.notFound"),
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

          if (customerData.start_date && customerData.end_date) {
            const { data: existingEvent, error: eventError } = await supabase
              .from('events')
              .select('id')
              .eq('title', customerData.title)
              .eq('start_date', customerData.start_date)
              .eq('end_date', customerData.end_date)
              .maybeSingle();

            if (eventError) {
              console.error('Error fetching associated event:', eventError);
              // Continue anyway, this is not critical
            } else if (existingEvent) {
              setAssociatedEventId(existingEvent.id);
            }
          }
        }
      } catch (error: any) {
        console.error('Error fetching customer/event data:', error);
        toast({
          title: t("common.error"),
          description: error.message || t("common.fetchError"),
          variant: "destructive",
        });
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [customerId, isOpen, user, t, onClose]);

  const checkTimeSlotAvailability = async (startDate: string, endDate: string, excludeEventId?: string): Promise<boolean> => {
    if (!user?.id) return false;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let query = supabase
      .from('events')
      .select('id, start_date, end_date')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(`start_date.lt.${end.toISOString()},end_date.gt.${start.toISOString()}`);
      
    if (excludeEventId) {
      query = query.neq('id', excludeEventId);
    }
    
    const { data: existingEvents, error } = await query;

    if (error) {
      console.error('Error checking time slot availability:', error);
      toast({
        title: t("common.error"),
        description: t("common.timeSlotCheckError"),
        variant: "destructive",
      });
      return false;
    }

    if (!existingEvents?.length) return true;

    return !existingEvents.some(event => {
      const eventStart = parseISO(event.start_date);
      const eventEnd = parseISO(event.end_date);
      
      return (start < eventEnd && end > eventStart);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: t("common.error"),
        description: t("common.missingUserInfo"),
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      if (createEvent && startDate && endDate) {
        const isTimeSlotAvailable = await checkTimeSlotAvailability(
          startDate,
          endDate,
          associatedEventId || undefined
        );

        if (!isTimeSlotAvailable) {
          toast({
            title: t("common.error"),
            description: t("common.timeSlotConflict"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const formattedStartDate = createEvent && startDate ? new Date(startDate).toISOString() : null;
      const formattedEndDate = createEvent && endDate ? new Date(endDate).toISOString() : null;

      const customerData = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        payment_status: paymentStatus || null,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        user_id: user.id,
        start_date: formattedStartDate,
        end_date: formattedEndDate,
      };

      let customerId_local = customerId;
      
      // Handle existing customer or event
      if (customerId) {
        if (customerId.startsWith('event-')) {
          // We're updating an event directly
          const eventId = customerId.replace('event-', '');
          const { error: eventError } = await supabase
            .from('events')
            .update(customerData)
            .eq('id', eventId)
            .eq('user_id', user.id);

          if (eventError) throw eventError;
          
          // Check if we need to update a corresponding customer record
          const { data: matchingCustomer, error: matchingError } = await supabase
            .from('customers')
            .select('id')
            .eq('title', title)
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (!matchingError && matchingCustomer) {
            await supabase
              .from('customers')
              .update(customerData)
              .eq('id', matchingCustomer.id)
              .eq('user_id', user.id);
          }
          
          customerId_local = eventId;
        } else {
          // We're updating a customer
          const { error: customerError } = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', customerId)
            .eq('user_id', user.id);

          if (customerError) throw customerError;

          if (createEvent) {
            const eventData = {
              ...customerData,
              type: 'customer_event',
              start_date: formattedStartDate,
              end_date: formattedEndDate,
            };

            if (associatedEventId) {
              // Update the associated event
              const { error: eventError } = await supabase
                .from('events')
                .update(eventData)
                .eq('id', associatedEventId)
                .eq('user_id', user.id);

              if (eventError) throw eventError;
            } else {
              // Create a new event
              const { error: eventError } = await supabase
                .from('events')
                .insert([eventData]);

              if (eventError) throw eventError;
            }
          }
        }
      } else {
        // Creating a new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([customerData])
          .select('id')
          .single();

        if (customerError) throw customerError;
        
        customerId_local = newCustomer.id;

        if (createEvent) {
          const eventData = {
            ...customerData,
            type: 'customer_event',
            start_date: formattedStartDate,
            end_date: formattedEndDate,
          };

          const { error: eventError } = await supabase
            .from('events')
            .insert([eventData]);

          if (eventError) throw eventError;
        }
      }

      // Handle file upload if a file is selected
      if (selectedFile && customerId_local) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        // Determine the bucket based on whether we're dealing with an event or customer
        const bucketName = customerId?.startsWith('event-') || isEventData 
          ? 'event_attachments' 
          : 'customer_attachments';
          
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          throw uploadError;
        }
        
        // Save file record in the appropriate table
        if (customerId?.startsWith('event-') || isEventData) {
          const actualEventId = customerId?.startsWith('event-') 
            ? customerId.replace('event-', '') 
            : associatedEventId;
            
          const fileData = {
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id,
            event_id: actualEventId
          };

          const { error: fileError } = await supabase
            .from('event_files')
            .insert([fileData]);

          if (fileError) throw fileError;
        } else {
          const fileData = {
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id,
            customer_id: customerId_local
          };

          const { error: fileError } = await supabase
            .from('customer_files_new')
            .insert([fileData]);

          if (fileError) throw fileError;
        }
      }

      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      
      toast({
        title: t("common.success"),
        description: customerId 
          ? t("crm.updateSuccess") 
          : t("crm.createSuccess"),
      });

      onClose();
    } catch (error: any) {
      console.error('Error handling customer submission:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.saveError"),
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
