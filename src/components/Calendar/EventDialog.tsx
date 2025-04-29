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
import { cn } from "@/lib/utils";

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
  // Always use user_surname as the primary name field to ensure consistency
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [originalStartDate, setOriginalStartDate] = useState("");
  const [originalEndDate, setOriginalEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [isBookingEvent, setIsBookingEvent] = useState(false);
  const isGeorgian = language === 'ka';

  // Synchronize fields when event data changes or when dialog opens
  useEffect(() => {
    if (event) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      
      console.log("Loading event data:", event);
      
      // Set both title and userSurname to the user_surname value for consistency
      const fullName = event.user_surname || event.title || "";
      setTitle(fullName);
      setUserSurname(fullName);
      
      setUserNumber(event.user_number || event.requester_phone || "");
      setSocialNetworkLink(event.social_network_link || event.requester_email || "");
      setEventNotes(event.event_notes || event.description || "");
      
      // Normalize payment status to handle different formats
      let normalizedStatus = event.payment_status || "not_paid";
      if (normalizedStatus === 'partly') normalizedStatus = 'partly_paid';
      else if (normalizedStatus === 'fully') normalizedStatus = 'fully_paid';
      else normalizedStatus = 'not_paid';
      
      console.log("Setting normalized payment status:", normalizedStatus);
      setPaymentStatus(normalizedStatus);
      setPaymentAmount(event.payment_amount?.toString() || "");
      
      const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
      const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
      
      setStartDate(formattedStart);
      setEndDate(formattedEnd);
      setOriginalStartDate(formattedStart);
      setOriginalEndDate(formattedEnd);
      
      setIsBookingEvent(event.type === 'booking_request');
      
      console.log("EventDialog - Loaded event with type:", event.type);
      console.log("EventDialog - Loaded payment status:", normalizedStatus);
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
      setPaymentStatus("not_paid");
      
      // Clear all other fields when creating a new event
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setPaymentAmount("");
      setSelectedFile(null);
      setFileError("");
    }
  }, [selectedDate, event, open]);

  // Load files for this event
  useEffect(() => {
    const loadFiles = async () => {
      if (event?.id) {
        try {
          console.log("Loading files for event:", event.id);
          console.log("Event type:", event.type);
          console.log("Booking request ID:", event.booking_request_id);
          
          // First check if this is a booking request ID directly
          const { data: bookingFiles, error: bookingFilesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', event.id);
            
          if (bookingFilesError) {
            console.error("Error loading booking files:", bookingFilesError);
          } else if (bookingFiles && bookingFiles.length > 0) {
            console.log("Found files directly associated with ID:", bookingFiles.length);
          }
          
          // Get any files associated with the booking request that created this event
          let relatedBookingFiles: any[] = [];
          if (event.booking_request_id) {
            console.log("This event has a booking request ID, checking for booking files:", event.booking_request_id);
            
            const { data: relatedFiles, error: relatedFilesError } = await supabase
              .from('event_files')
              .select('*')
              .eq('event_id', event.booking_request_id);
              
            if (!relatedFilesError && relatedFiles) {
              console.log("Found files from the original booking request:", relatedFiles.length);
              relatedBookingFiles = relatedFiles;
            }
          }
          
          // Use a Set to track unique file IDs to avoid duplicates
          const uniqueFileIds = new Set<string>();
          const uniqueFiles: any[] = [];
          
          const allFiles = [...(bookingFiles || []), ...relatedBookingFiles];
          
          allFiles.forEach(file => {
            if (!uniqueFileIds.has(file.id)) {
              uniqueFileIds.add(file.id);
              uniqueFiles.push({
                ...file,
                parentType: 'event'
              });
            }
          });
          
          if (uniqueFiles.length > 0) {
            console.log("Loaded unique event files:", uniqueFiles.length);
            setDisplayedFiles(uniqueFiles);
          } else {
            console.log("No files found for event or booking ID:", event.id);
            setDisplayedFiles([]);
          }
          
        } catch (err) {
          console.error("Exception loading event files:", err);
        }
      }
    };
    
    if (open) {
      loadFiles();
    }
  }, [event, open, isBookingRequest]);

  // Function to send approval email notification
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
      
      const responseText = await response.text();
      console.log("Email API response text:", responseText);
      
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
      throw emailError;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Always use userSurname for consistent naming across the app
    const finalTitle = userSurname;
    
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
    
    // Ensure payment status is properly normalized
    let normalizedPaymentStatus = paymentStatus;
    if (normalizedPaymentStatus === 'partly') normalizedPaymentStatus = 'partly_paid';
    else if (normalizedPaymentStatus === 'fully') normalizedPaymentStatus = 'fully_paid';
    else if (normalizedPaymentStatus === 'not_paid') normalizedPaymentStatus = 'not_paid';
    
    console.log("Submitting with payment status:", normalizedPaymentStatus);
    
    const eventData: Partial<CalendarEventType> = {
      title: finalTitle,
      user_surname: userSurname, // Use userSurname for consistent naming
      user_number: userNumber,
      social_network_link: socialNetworkLink,
      event_notes: eventNotes,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      payment_status: normalizedPaymentStatus, // Use normalized payment status
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
    };

    if (event?.id) {
      eventData.id = event.id;
    }
    
    // Preserve the booking_request_id if it exists
    if (event?.booking_request_id) {
      eventData.booking_request_id = event.booking_request_id;
    }

    if (wasBookingRequest) {
      eventData.type = 'event';
      // If this is a booking request being approved, store its ID to track relationship
      if (isApprovingBookingRequest) {
        eventData.booking_request_id = event.id;
      }
      console.log("Converting booking request to event:", { 
        wasBookingRequest, 
        isApprovingBookingRequest,
        bookingRequestId: eventData.booking_request_id 
      });
    } else if (event?.type) {
      eventData.type = event.type;
    } else {
      eventData.type = 'event'; // Default type if not set
    }

    try {
      console.log("EventDialog - Submitting event data:", eventData);
      const createdEvent = await onSubmit(eventData);
      console.log('Created/Updated event:', createdEvent);

      let emailSent = false;

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
        }
      }

      // Handle file upload for new event
      if (selectedFile && createdEvent?.id && user) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${crypto.randomUUID()}.${fileExt}`;
          
          console.log('Uploading file:', filePath);
          
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }

          const fileData = {
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id,
            event_id: createdEvent.id
          };

          const { error: fileRecordError } = await supabase
            .from('event_files')
            .insert(fileData);
            
          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
            throw fileRecordError;
          }

          console.log('File record created successfully');
        } catch (fileError) {
          console.error("Error handling file upload:", fileError);
        }
      }

      // Special handling for booking requests being converted to events
      if (isApprovingBookingRequest && event?.id) {
        try {
          console.log("Copying files from booking request to approved event");
          
          // Get files associated with the booking request
          const { data: requestFiles, error: filesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', event.id);
            
          if (filesError) {
            console.error("Error fetching booking request files:", filesError);
          } else if (requestFiles && requestFiles.length > 0) {
            console.log(`Found ${requestFiles.length} files to copy from booking request`);
            
            // Create new file records linking to the created event
            for (const file of requestFiles) {
              const newFileData = {
                filename: file.filename,
                file_path: file.file_path, // Reuse the same file in storage
                content_type: file.content_type,
                size: file.size,
                user_id: user.id,
                event_id: createdEvent.id
              };
              
              const { error: copyError } = await supabase
                .from('event_files')
                .insert(newFileData);
                
              if (copyError) {
                console.error("Error copying file record:", copyError);
              } else {
                console.log("Successfully copied file from booking request to event");
              }
            }
          }
        } catch (copyError) {
          console.error("Error copying booking request files:", copyError);
        }
      }

      if (!isBookingEvent) {
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
              // Update payment status and amount in booking_requests table
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
                  payment_status: normalizedPaymentStatus,
                  payment_amount: paymentAmount ? parseFloat(paymentAmount) : null
                })
                .eq('id', event.id);
                
              if (updateError) {
                console.error('Error updating booking request:', updateError);
              } else {
                console.log('Updated booking request successfully with payment:', normalizedPaymentStatus, paymentAmount);
              }
            }
          } catch (bookingError) {
            console.error("Error updating booking request:", bookingError);
          }
        }
      }

      onOpenChange(false);
      
      // Invalidate all queries to ensure data is refreshed
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      
    } catch (error: any) {
      console.error('Error handling event submission:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.error"),
        variant: "destructive",
      });
    }
  };

  const handleFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
          {event ? t("events.editEvent") : t("events.addNewEvent")}
        </DialogTitle>
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
