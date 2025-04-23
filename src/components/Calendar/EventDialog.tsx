
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { Trash2 } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultEndDate?: Date | null;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onDelete?: () => void;
  event?: CalendarEventType;
  isBookingRequest?: boolean;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  onDelete,
  event,
  isBookingRequest = false
}: EventDialogProps) => {
  const [title, setTitle] = useState(event?.title || "");
  const [userSurname, setUserSurname] = useState(event?.user_surname || "");
  const [userNumber, setUserNumber] = useState(event?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(event?.social_network_link || "");
  const [eventNotes, setEventNotes] = useState(event?.event_notes || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [originalStartDate, setOriginalStartDate] = useState("");
  const [originalEndDate, setOriginalEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(event?.payment_status || "");
  const [paymentAmount, setPaymentAmount] = useState(event?.payment_amount?.toString() || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [isBookingEvent, setIsBookingEvent] = useState(false);

  useEffect(() => {
    if (event) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      setTitle(event.title || "");
      setUserSurname(event.user_surname || event.requester_name || "");
      setUserNumber(event.user_number || event.requester_phone || "");
      setSocialNetworkLink(event.social_network_link || event.requester_email || "");
      setEventNotes(event.event_notes || event.description || "");
      setPaymentStatus(event.payment_status || "");
      setPaymentAmount(event.payment_amount?.toString() || "");
      
      const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
      const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
      
      setStartDate(formattedStart);
      setEndDate(formattedEnd);
      setOriginalStartDate(formattedStart);
      setOriginalEndDate(formattedEnd);
      
      setIsBookingEvent(event.type === 'booking_request');
      
      console.log("EventDialog - Loaded event with type:", event.type);
    } else if (selectedDate) {
      const start = new Date(selectedDate.getTime());
      const end = new Date(selectedDate.getTime());
      
      end.setHours(end.getHours() + 1);
      
      const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
      const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
      
      setStartDate(formattedStart);
      setEndDate(formattedEnd);
      setOriginalStartDate(formattedStart);
      setOriginalEndDate(formattedEnd);
    }
  }, [selectedDate, event, open]);

  useEffect(() => {
    const loadFiles = async () => {
      if (event?.id) {
        try {
          // First check if this is a booking request
          if (event.type === 'booking_request') {
            console.log("Loading files for booking request:", event.id);
            
            const { data: bookingData, error: bookingError } = await supabase
              .from('booking_requests')
              .select('file_path, filename')
              .eq('id', event.id)
              .single();
              
            if (!bookingError && bookingData && bookingData.file_path) {
              console.log("Found booking file:", bookingData);
              
              // Create a virtual file entry for the booking request file
              const bookingFile = {
                id: `booking-${event.id}`,
                event_id: event.id,
                filename: bookingData.filename || 'attachment',
                file_path: bookingData.file_path,
                content_type: '',
                size: 0,
                created_at: new Date().toISOString(),
                user_id: user?.id,
                source: 'booking_request'
              };
              
              setDisplayedFiles([bookingFile]);
              return;
            }
          }
          
          // If not a booking or no file in booking, check standard event files
          const { data, error } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', event.id);
            
          if (error) {
            console.error("Error loading event files:", error);
            return;
          }
          
          if (data && data.length > 0) {
            console.log("Loaded event files:", data);
            setDisplayedFiles(data);
          }
        } catch (err) {
          console.error("Exception loading event files:", err);
        }
      }
    };
    
    if (open) {
      loadFiles();
    }
  }, [event, open, user?.id]);

  const sendApprovalEmail = async (
    startDateTime: Date,
    endDateTime: Date,
    title: string,
    userSurname: string,
    socialNetworkLink: string
  ) => {
    try {
      console.log("Sending booking approval email to", socialNetworkLink);
      
      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('user_id', user?.id)
        .maybeSingle();
        
      const businessName = businessProfile?.business_name || "Our Business";
      
      console.log("Email data:", {
        recipientEmail: socialNetworkLink,
        fullName: userSurname || title,
        businessName,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
      });
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available for authenticated request");
        throw new Error("Authentication error");
      }
      
      const response = await fetch(
        "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            recipientEmail: socialNetworkLink.trim(),
            fullName: userSurname || title || "Customer",
            businessName,
            startDate: startDateTime.toISOString(),
            endDate: endDateTime.toISOString(),
          }),
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
        // Continue with the text response
        responseData = { textResponse: responseText };
      }
      
      if (!response.ok) {
        console.error("Failed to send email notification:", responseData?.error || response.statusText);
        throw new Error(responseData?.error || responseData?.details || `Failed to send email notification (status ${response.status})`);
      }
      
      toast({
        title: t("common.success"),
        description: t("Email notification sent successfully to ") + socialNetworkLink,
      });
      
    } catch (emailError) {
      console.error("Error sending email notification:", emailError);
      toast({
        title: t("common.warning"),
        description: t("Event created but email notification could not be sent: ") + 
          (emailError instanceof Error ? emailError.message : "Unknown error"),
        variant: "destructive",
      });
      throw emailError; // Re-throw to handle it in the calling function
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    const timesChanged = startDate !== originalStartDate || endDate !== originalEndDate;
    console.log("Time changed during edit?", timesChanged, {
      originalStart: originalStartDate,
      currentStart: startDate,
      originalEnd: originalEndDate,
      currentEnd: endDate
    });

    const wasBookingRequest = event?.type === 'booking_request';
    const isApprovingBookingRequest = wasBookingRequest && !isBookingEvent;
    
    const eventData: Partial<CalendarEventType> = {
      title,
      user_surname: userSurname,
      user_number: userNumber,
      social_network_link: socialNetworkLink,
      event_notes: eventNotes,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      payment_status: paymentStatus || null,
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
    };

    if (event?.id) {
      eventData.id = event.id;
    }

    if (wasBookingRequest) {
      eventData.type = 'event';
      console.log("Converting booking request to event:", { wasBookingRequest, isApprovingBookingRequest });
    } else if (event?.type) {
      eventData.type = event.type;
    }

    try {
      console.log("EventDialog - Submitting event data:", eventData);
      const createdEvent = await onSubmit(eventData);
      console.log('Created/Updated event:', createdEvent);

      let emailSent = false;

      // Handle sending approval email based on conditions
      if ((isApprovingBookingRequest || !event?.id || event.type === 'booking_request') && 
          socialNetworkLink && 
          socialNetworkLink.includes("@")) {
            
        console.log(">>> APPROVAL EMAIL CONDITION MET", {
          wasBookingRequest,
          isApprovingBookingRequest,
          eventId: event?.id,
          newType: eventData.type,
          email: socialNetworkLink
        });
        
        try {
          await sendApprovalEmail(
            startDateTime,
            endDateTime,
            title,
            userSurname,
            socialNetworkLink
          );
          emailSent = true;
        } catch (emailError) {
          console.error("Failed to send approval email:", emailError);
          // We continue with event creation even if email fails
        }
      }

      // Handle file upload if there's a selected file
      if (!isBookingEvent) {
        // Process files from both sources - selected file and booking request file
        if (selectedFile && createdEvent?.id && user) {
          try {
            // Upload the new selected file
            await uploadFileToEvent(selectedFile, createdEvent.id, user.id);
          } catch (fileError) {
            console.error("Error handling file upload:", fileError);
            // Continue even if file upload fails
          }
        }
        
        // Transfer file from booking request if approving
        if (isApprovingBookingRequest && event?.id && createdEvent?.id) {
          try {
            // Check if booking request has a file
            const { data: bookingData, error: bookingError } = await supabase
              .from('booking_requests')
              .select('file_path, filename')
              .eq('id', event.id)
              .single();
              
            if (!bookingError && bookingData && bookingData.file_path && user) {
              console.log("Transferring file from booking request to event:", bookingData.file_path);
              
              // Create a file record for the booking request file
              const { error: fileRecordError } = await supabase
                .from('event_files')
                .insert({
                  event_id: createdEvent.id,
                  filename: bookingData.filename || 'attachment',
                  file_path: bookingData.file_path,
                  content_type: 'application/octet-stream',
                  size: 0,
                  user_id: user.id
                });
                
              if (fileRecordError) {
                console.error('Error creating file record from booking:', fileRecordError);
              } else {
                console.log('Successfully transferred file from booking to event');
              }
            }
          } catch (transferError) {
            console.error("Error transferring booking file:", transferError);
          }
        }

        toast({
          title: t("common.success"),
          description: `${event?.id ? t("Event updated successfully") : t("Event created successfully")}${
            emailSent ? " " + t("and notification email sent") : ""
          }`,
        });
      } else {
        if (event?.id) {
          try {
            const { data: bookingRequest, error: findError } = await supabase
              .from('booking_requests')
              .select('*')
              .eq('id', event.id)
              .maybeSingle();
              
            if (!findError && bookingRequest) {
              const { error: updateError } = await supabase
                .from('booking_requests')
                .update({
                  title,
                  requester_name: userSurname,
                  requester_phone: userNumber,
                  requester_email: socialNetworkLink,
                  description: eventNotes,
                  start_date: startDateTime.toISOString(),
                  end_date: endDateTime.toISOString(),
                })
                .eq('id', event.id);
                
              if (updateError) {
                console.error('Error updating booking request:', updateError);
              } else {
                console.log('Updated booking request successfully');
              }
            }
          } catch (bookingError) {
            console.error("Error updating booking request:", bookingError);
          }
        }
      }

      onOpenChange(false);
      
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
    } catch (error: any) {
      console.error('Error handling event submission:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.error"),
        variant: "destructive",
      });
    }
  };

  // New helper function to upload files to events
  const uploadFileToEvent = async (file: File, eventId: string, userId: string) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${crypto.randomUUID()}.${fileExt}`;
    
    console.log('Uploading file:', filePath);
    
    const { error: uploadError } = await supabase.storage
      .from('event_attachments')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    const { error: fileRecordError } = await supabase
      .from('event_files')
      .insert({
        event_id: eventId,
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
        user_id: userId
      });
      
    if (fileRecordError) {
      console.error('Error creating file record:', fileRecordError);
      throw fileRecordError;
    }

    console.log('File record created successfully');
    return true;
  };

  const handleFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{event ? t("events.editEvent") : t("events.addNewEvent")}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <EventDialogFields
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
            eventId={event?.id}
            onFileDeleted={handleFileDeleted}
            displayedFiles={displayedFiles}
            isBookingRequest={isBookingRequest}
          />
          
          <div className="flex justify-between gap-4">
            <Button type="submit" className="flex-1">
              {event ? t("events.updateEvent") : t("events.createEvent")}
            </Button>
            {event && onDelete && (
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

export default EventDialog;
