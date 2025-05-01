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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle } from "lucide-react";

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

// Define a consistent return type interface for the sendApprovalEmail function
interface EmailResult {
  success: boolean;
  message?: string;
  error?: string;
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
  const [paymentStatus, setPaymentStatus] = useState(initialData?.payment_status || "not_paid");
  const [paymentAmount, setPaymentAmount] = useState(initialData?.payment_amount?.toString() || "");
  const [customerNotes, setCustomerNotes] = useState(initialData?.event_notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isEventBased, setIsEventBased] = useState(false);
  
  // Add start and end date state with proper initialization
  const now = new Date();
  const startHour = new Date(now);
  startHour.setHours(9, 0, 0, 0);
  const endHour = new Date(now);
  endHour.setHours(10, 0, 0, 0);
  
  const [eventStartDate, setEventStartDate] = useState<Date>(startHour);
  const [eventEndDate, setEventEndDate] = useState<Date>(endHour);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  useEffect(() => {
    if (initialData) {
      // Use the same value for both title and userSurname to maintain consistency
      const fullName = initialData.title || "";
      setTitle(fullName);
      setUserSurname(fullName);
      
      setUserNumber(initialData.user_number || "");
      setSocialNetworkLink(initialData.social_network_link || "");
      setCreateEvent(initialData.create_event || false);
      
      // Normalize payment status
      let normalizedStatus = initialData.payment_status || "not_paid";
      if (normalizedStatus.includes('partly')) normalizedStatus = 'partly';
      else if (normalizedStatus.includes('fully')) normalizedStatus = 'fully';
      else if (normalizedStatus.includes('not')) normalizedStatus = 'not_paid';
      
      setPaymentStatus(normalizedStatus);
      setPaymentAmount(initialData.payment_amount?.toString() || "");
      setCustomerNotes(initialData.event_notes || "");
      
      setIsEventBased(!!initialData.start_date && !!initialData.end_date);
      
      // Initialize dates from initialData if available
      if (initialData.start_date) {
        setEventStartDate(new Date(initialData.start_date));
      }
      
      if (initialData.end_date) {
        setEventEndDate(new Date(initialData.end_date));
      }
    } else {
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setCreateEvent(false);
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setCustomerNotes("");
      setIsEventBased(false);
      
      // Reset to default dates
      const now = new Date();
      const startHour = new Date(now);
      startHour.setHours(9, 0, 0, 0);
      const endHour = new Date(now);
      endHour.setHours(10, 0, 0, 0);
      
      setEventStartDate(startHour);
      setEventEndDate(endHour);
    }
  }, [initialData, open]);

  const sendApprovalEmail = async (recipient: string, fullName: string, businessName: string, startDate: Date, endDate: Date): Promise<EmailResult> => {
    try {
      console.log("Sending booking approval email to:", recipient);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available for authenticated request");
        return { success: false, error: "Authentication error" };
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
        return { 
          success: false, 
          error: responseData?.error || responseData?.details || `Failed to send email notification (status ${response.status})` 
        };
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

  // New function to check if a time slot is available
  const checkTimeSlotAvailability = async (startDate: Date, endDate: Date): Promise<{available: boolean, conflictDetails?: string}> => {
    if (!user) {
      return { available: false, conflictDetails: "User not authenticated" };
    }
    
    try {
      console.log("Checking availability for:", startDate.toISOString(), "to", endDate.toISOString());
      
      // Check for conflicts with existing events
      const { data: existingEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date')
        .eq('user_id', user.id)
        .filter('start_date', 'lt', endDate.toISOString())
        .filter('end_date', 'gt', startDate.toISOString())
        .is('deleted_at', null);
      
      if (eventsError) {
        console.error("Error checking event conflicts:", eventsError);
        return { available: false, conflictDetails: "Error checking schedule" };
      }
      
      if (existingEvents && existingEvents.length > 0) {
        console.log("Found conflicting events:", existingEvents);
        
        const firstConflict = existingEvents[0];
        return {
          available: false,
          conflictDetails: `"${firstConflict.title}" - ${
            new Date(firstConflict.start_date).toLocaleTimeString()} - ${
            new Date(firstConflict.end_date).toLocaleTimeString()}`
        };
      }
      
      // Check for conflicts with approved booking requests
      const businessProfileQuery = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (!businessProfileQuery.error && businessProfileQuery.data?.id) {
        const businessId = businessProfileQuery.data.id;
        
        const { data: approvedBookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('id, title, start_date, end_date')
          .eq('business_id', businessId)
          .eq('status', 'approved')
          .filter('start_date', 'lt', endDate.toISOString())
          .filter('end_date', 'gt', startDate.toISOString())
          .is('deleted_at', null);
          
        if (bookingsError) {
          console.error("Error checking booking conflicts:", bookingsError);
        } else if (approvedBookings && approvedBookings.length > 0) {
          console.log("Found conflicting bookings:", approvedBookings);
          
          const firstConflict = approvedBookings[0];
          return {
            available: false,
            conflictDetails: `${t("bookings.approvedBooking")}: "${firstConflict.title}" - ${
              new Date(firstConflict.start_date).toLocaleTimeString()} - ${
              new Date(firstConflict.end_date).toLocaleTimeString()}`
          };
        }
      }
      
      return { available: true };
    } catch (error) {
      console.error("Error checking time slot availability:", error);
      return { available: false, conflictDetails: "Error checking availability" };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Always synchronize title and user_surname to be the same value
      // This ensures the full name is consistently displayed across the application
      const fullName = title;
      
      // If creating an event, check time slot availability first
      if (createEvent) {
        const { available, conflictDetails } = await checkTimeSlotAvailability(eventStartDate, eventEndDate);
        if (!available) {
          // Show a more user-friendly message with better styling
          toast({
            title: t("events.timeSlotUnavailable"),
            description: (
              <div className="flex items-center gap-2 font-medium text-amber-800 bg-amber-50 p-2 rounded-md border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>{t("events.timeSlotConflict")}: {conflictDetails}</span>
              </div>
            ),
            variant: "default",
            duration: 5000,
          });
          setIsSubmitting(false);
          return;
        }
      }
      
      const customerData: CustomerType = {
        title: fullName,
        user_surname: fullName, // Use the same value for consistent naming
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
            start_date: createEvent ? eventStartDate.toISOString() : null,
            end_date: createEvent ? eventEndDate.toISOString() : null,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        customerId = data.id;
        console.log("Created customer:", data);
      }

      let emailResult: EmailResult = { success: false };
      let eventId: string | undefined;
      let uploadedFilePath: string | undefined;

      // If createEvent is checked, create a corresponding event
      if (createEvent) {
        // This is the critical part - make sure all fields are properly carried over
        // Ensure user_surname and title are consistent by using the same value
        const eventData = {
          title: fullName,
          user_surname: fullName, 
          user_number: userNumber,
          social_network_link: socialNetworkLink,
          event_notes: customerNotes,
          start_date: eventStartDate.toISOString(),
          end_date: eventEndDate.toISOString(),
          payment_status: paymentStatus, // Ensure payment status is properly set
          payment_amount: paymentStatus && paymentStatus !== 'not_paid' ? parseFloat(paymentAmount) : null,
          user_id: user?.id,
          type: 'event'  // Explicitly set the type
        };

        console.log("Creating event with data:", eventData);

        const { data: eventData2, error: eventError } = await supabase
          .from('events')
          .insert(eventData)
          .select()
          .single();

        if (eventError) {
          console.error("Error creating event:", eventError);
          throw eventError;
        } else {
          console.log("Created event:", eventData2);
          eventId = eventData2.id;
          
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
                fullName,
                businessName,
                eventStartDate,
                eventEndDate
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

      // Handle file upload if a file is selected
      if (selectedFile) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${Date.now()}_${customerId}.${fileExt}`;
          uploadedFilePath = filePath;
          
          // Upload file to storage - Always use event_attachments for consistency
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, selectedFile);
  
          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }
  
          // Create customer file record
          const customerFileData = {
            customer_id: customerId,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user?.id
          };
          
          const { error: customerFileError } = await supabase
            .from('customer_files_new')
            .insert(customerFileData);
  
          if (customerFileError) {
            console.error('Error creating customer file record:', customerFileError);
            throw customerFileError;
          }
          
          // Only create event file record if event was created and we haven't already created a file for this event
          if (createEvent && eventId && uploadedFilePath) {
            const eventFileData = {
              event_id: eventId,
              filename: selectedFile.name,
              file_path: filePath, // Use the same file path to prevent duplication
              content_type: selectedFile.type,
              size: selectedFile.size,
              user_id: user?.id
            };
            
            const { error: eventFileError } = await supabase
              .from('event_files')
              .insert(eventFileData);
  
            if (eventFileError) {
              console.error('Error creating event file record:', eventFileError);
              // Don't throw here, continue with customer file at least
            }
          }
        } catch (fileError) {
          console.error('Error handling file upload:', fileError);
          toast({
            title: t("common.warning"),
            description: t("Customer created but file upload failed"),
            variant: "destructive",
          });
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

      // Force refresh data to ensure calendar and lists are updated
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      
      // Add an additional refresh for events to ensure calendar updates
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['business-events'] });
        queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      }, 500);
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
            setTitle={(value) => {
              // Keep title and userSurname in sync
              setTitle(value);
              setUserSurname(value);
            }}
            userSurname={userSurname}
            setUserSurname={(value) => {
              // Keep title and userSurname in sync
              setUserSurname(value);
              setTitle(value);
            }}
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
            eventStartDate={eventStartDate}
            setEventStartDate={setEventStartDate}
            eventEndDate={eventEndDate}
            setEventEndDate={setEventEndDate}
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
