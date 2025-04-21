import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export interface CustomerType {
  id?: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  create_event?: boolean;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

interface CustomerDialogProps {
  customerId?: string;
  initialData?: Partial<CustomerType>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: CustomerType) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const CustomerDialog = ({
  customerId,
  initialData,
  open,
  onOpenChange,
  onSubmit,
  isOpen,
  onClose,
}: CustomerDialogProps) => {
  const isDialogOpen = open || isOpen || false;
  const handleOpenChange = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    if (!value && onClose) onClose();
  };

  const [title, setTitle] = useState(initialData?.title || "");
  const [userSurname, setUserSurname] = useState(initialData?.user_surname || "");
  const [userNumber, setUserNumber] = useState(initialData?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(initialData?.social_network_link || "");
  const [createEvent, setCreateEvent] = useState(initialData?.create_event || false);
  const [paymentStatus, setPaymentStatus] = useState(initialData?.payment_status || "");
  const [paymentAmount, setPaymentAmount] = useState(initialData?.payment_amount?.toString() || "");
  const [customerNotes, setCustomerNotes] = useState(initialData?.event_notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isEventBased, setIsEventBased] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setUserSurname(initialData.user_surname || "");
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setCreateEvent(initialData.create_event || false);
      setPaymentStatus(initialData.payment_status || "");
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setCustomerNotes(initialData.event_notes || "");
      
      setIsEventBased(!!initialData.start_date && !!initialData.end_date);
    } else {
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setCreateEvent(false);
      setPaymentStatus("");
      setPaymentAmount("");
      setCustomerNotes("");
      setIsEventBased(false);
    }
  }, [initialData, open]);

  const sendApprovalEmail = async (recipient: string, fullName: string, businessName: string, startDate: Date, endDate: Date) => {
    try {
      console.log("Sending booking approval email to:", recipient);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available for authenticated request");
        throw new Error("Authentication error");
      }
      
      const requestBody = JSON.stringify({
        recipientEmail: recipient.trim(),
        fullName: fullName || "Customer",
        businessName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      
      console.log("Email request body:", requestBody);
      
      const response = await fetch(
        "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: requestBody,
        }
      );
      
      console.log("Email API response status:", response.status);
      
      // Read the response as text first
      const responseText = await response.text();
      console.log("Email API response text:", responseText);
      
      // Try to parse the JSON
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
        console.log("Email API parsed response:", responseData);
      } catch (jsonError) {
        console.error("Failed to parse email API response as JSON:", jsonError);
        responseData = { textResponse: responseText };
      }
      
      if (!response.ok) {
        console.error("Failed to send email notification:", responseData?.error || response.statusText);
        throw new Error(responseData?.error || responseData?.details || `Failed to send email notification (status ${response.status})`);
      }
      
      return { success: true, message: "Email sent successfully" };
    } catch (error) {
      console.error("Error sending email:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    if (isSubmitting) return;

    const now = new Date();
    const start = new Date(now);
    start.setHours(9, 0, 0, 0);
    const end = new Date(now);
    end.setHours(10, 0, 0, 0);

    setIsSubmitting(true);

    try {
      const customerData: CustomerType = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: customerNotes,
        create_event: createEvent,
        payment_status: createEvent ? paymentStatus : null,
        payment_amount: createEvent && paymentStatus && paymentStatus !== 'not_paid' ? parseFloat(paymentAmount) : null,
        user_id: user?.id,
        start_date: initialData?.start_date,
        end_date: initialData?.end_date
      };

      let customerId: string | undefined;

      if (initialData?.id) {
        const { data, error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', initialData.id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        customerId = data.id;
        console.log("Updated customer:", data);
      } else {
        const { data, error } = await supabase
          .from('customers')
          .insert({
            ...customerData,
            type: 'customer',
            start_date: createEvent ? start.toISOString() : null,
            end_date: createEvent ? end.toISOString() : null,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        customerId = data.id;
        console.log("Created customer:", data);
      }

      let emailResult = { success: false, message: "" };

      if (createEvent) {
        const eventData = {
          title,
          user_surname: userSurname,
          user_number: userNumber,
          social_network_link: socialNetworkLink,
          event_notes: customerNotes,
          start_date: format(start, "yyyy-MM-dd'T'HH:mm"),
          end_date: format(end, "yyyy-MM-dd'T'HH:mm"),
          payment_status: paymentStatus || null,
          payment_amount: paymentStatus && paymentStatus !== 'not_paid' ? parseFloat(paymentAmount) : null,
          user_id: user?.id,
          customer_id: customerId,
        };

        console.log("Creating event with data:", eventData);

        const { data: eventData2, error: eventError } = await supabase
          .from('events')
          .insert(eventData)
          .select()
          .single();

        if (eventError) {
          console.error("Error creating event:", eventError);
        } else {
          console.log("Created event:", eventData2);
          
          if (socialNetworkLink && socialNetworkLink.includes('@')) {
            try {
              const { data: businessProfile } = await supabase
                .from('business_profiles')
                .select('business_name')
                .eq('user_id', user?.id)
                .maybeSingle();
                
              const businessName = businessProfile?.business_name || "Our Business";
              
              console.log("Sending booking approval email to", socialNetworkLink);
              
              emailResult = await sendApprovalEmail(
                socialNetworkLink,
                userSurname || title,
                businessName,
                start,
                end
              );
              
              if (emailResult.success) {
                toast({
                  title: t("common.success"),
                  description: t("Email notification sent successfully to ") + socialNetworkLink,
                });
              } else {
                throw new Error(emailResult.error || "Failed to send email notification");
              }
            } catch (emailError) {
              console.error("Error sending email notification:", emailError);
              toast({
                title: t("common.warning"),
                description: t("Event created but email notification could not be sent: ") + 
                  (emailError instanceof Error ? emailError.message : "Unknown error"),
                variant: "destructive",
              });
            }
          }
        }
      }

      if (selectedFile && customerId) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${customerId}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          throw uploadError;
        }

        const { error: fileError } = await supabase
          .from('customer_files_new')
          .insert({
            customer_id: customerId,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user?.id
          });

        if (fileError) {
          console.error('Error creating file record:', fileError);
          throw fileError;
        }
      }

      onOpenChange(false);
      
      toast({
        title: t("common.success"),
        description: `${initialData?.id ? t("crm.customerUpdated") : t("crm.customerCreated")}${
          emailResult.success ? " " + t("and notification email sent") : ""
        }`,
        duration: 3000,
      });

      if (onSubmit && customerId) {
        onSubmit({
          ...customerData,
          id: customerId,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (error: any) {
      console.error('Error submitting customer:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.errorOccurred"),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customerId ? t("crm.editCustomer") : t("crm.newCustomer")}</DialogTitle>
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
            createEvent={createEvent}
            setCreateEvent={setCreateEvent}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            customerNotes={customerNotes}
            setCustomerNotes={setCustomerNotes}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            isEventBased={isEventBased}
            startDate={initialData?.start_date}
            endDate={initialData?.end_date}
          />
          <DialogFooter className="mt-6">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.submitting") : customerId ? t("crm.update") : t("crm.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
