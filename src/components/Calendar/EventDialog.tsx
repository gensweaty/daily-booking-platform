import React, { useState, useEffect } from 'react';
import { format } from "date-fns";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { createFileObjectFromEvent } from "@/integrations/supabase/utils";

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
  const [eventFiles, setEventFiles] = useState<any[]>([]);
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
      console.log("EventDialog - Loaded event with file_path:", event.file_path);
      console.log("EventDialog - Loaded event with filename:", event.filename);
      
      const files = createFileObjectFromEvent(event);
      console.log("EventDialog - files for display:", files);
      setEventFiles(files);
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
      if (event.booking_request_id) {
        eventData.booking_request_id = event.booking_request_id;
      }
      
      if (event.file_path && event.filename) {
        eventData.file_path = event.file_path;
        eventData.filename = event.filename;
      }
    }

    if (wasBookingRequest) {
      eventData.type = 'event';
      eventData.booking_request_id = event.id;
      
      if (event.file_path && event.filename) {
        eventData.file_path = event.file_path;
        eventData.filename = event.filename;
      }
      
      console.log("Converting booking request to event:", { 
        wasBookingRequest, 
        isApprovingBookingRequest, 
        bookingId: event.id,
        filePath: eventData.file_path,
        fileName: eventData.filename
      });
    } else if (event?.type) {
      eventData.type = event.type;
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

      if (selectedFile && createdEvent?.id && user) {
        try {
          await uploadFileToEvent(selectedFile, createdEvent.id, user.id);
        } catch (fileError) {
          console.error("Error handling file upload:", fileError);
        }
      }

      if (!isBookingEvent) {
        if (wasBookingRequest) {
          try {
            const customerData = {
              title: eventData.title,
              user_surname: eventData.user_surname,
              user_number: eventData.user_number,
              social_network_link: eventData.social_network_link,
              event_notes: eventData.event_notes,
              start_date: eventData.start_date,
              end_date: eventData.end_date,
              payment_status: eventData.payment_status || null,
              payment_amount: eventData.payment_amount || null,
              user_id: user?.id,
              type: 'customer',
              create_event: false
            };

            console.log("Creating customer from approved booking:", customerData);
            
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert(customerData)
              .select()
              .single();
              
            if (customerError) {
              console.error("Error creating customer from booking:", customerError);
            } else if (newCustomer) {
              console.log("Created customer from booking:", newCustomer);

              const { error: eventUpdateError } = await supabase
                .from('events')
                .update({ customer_id: newCustomer.id })
                .eq('id', createdEvent.id);
                
              if (eventUpdateError) {
                console.error("Error updating event with customer ID:", eventUpdateError);
              }
            }
          } catch (customerCreationError) {
            console.error("Error in customer creation flow:", customerCreationError);
          }
        }

        toast({
          title: t("common.success"),
          description: `${event?.id ? t("Event updated successfully") : t("Event created successfully")}${
            emailSent ? " " + t("and notification email sent") : ""
          }`,
        });
      }

      onOpenChange(false);
      
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
    } catch (error: any) {
      console.error('Error handling event submission:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.error"),
        variant: "destructive",
      });
    }
  };

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

    const { error: updateError } = await supabase
      .from('events')
      .update({
        file_path: filePath,
        filename: file.name
      })
      .eq('id', eventId);
      
    if (updateError) {
      console.error('Error updating event with file path:', updateError);
      throw updateError;
    }

    console.log('Event updated with file path successfully');
    
    queryClient.invalidateQueries({ queryKey: ['events'] });
    
    return true;
  };

  const handleFileDeleted = (fileId: string) => {
    console.log("File deleted, refreshing file list");
    setEventFiles([]);
    
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
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
            isBookingRequest={isBookingRequest}
          />
          
          {event && eventFiles.length > 0 && (
            <div className="mt-4">
              <FileDisplay 
                files={eventFiles} 
                bucketName="event_attachments" 
                allowDelete={true}
                onFileDeleted={handleFileDeleted}
                parentId={event.id}
                parentType="event"
              />
            </div>
          )}
          
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
