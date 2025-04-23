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
      if (!event?.id) return;
      
      try {
        console.log("Loading files for event:", event.id, "type:", event.type, "booking_request_id:", event.booking_request_id);
        setDisplayedFiles([]);
        
        if (event.file_path || event.filename) {
          console.log("Found file information directly on the event:", event.file_path);
          const eventFile = {
            id: `event-file-${event.id}`,
            event_id: event.id,
            filename: event.filename || 'attachment',
            file_path: event.file_path || '',
            content_type: '',
            size: 0,
            created_at: new Date().toISOString(),
            user_id: user?.id,
            source: 'event'
          };
          
          setDisplayedFiles(prev => [...prev, eventFile]);
        }
        
        if (event.booking_request_id) {
          console.log("This is a converted booking. Checking original booking request files:", event.booking_request_id);
          
          const { data: bookingData, error: bookingError } = await supabase
            .from('booking_requests')
            .select('file_path, filename')
            .eq('id', event.booking_request_id)
            .maybeSingle();
            
          if (bookingError) {
            console.error("Error loading booking request file data:", bookingError);
          }
          
          if (!bookingError && bookingData && bookingData.file_path) {
            console.log("Found original booking file:", bookingData);
            
            const bookingFile = {
              id: `booking-${event.booking_request_id}`,
              event_id: event.id,
              filename: bookingData.filename || 'attachment',
              file_path: bookingData.file_path,
              content_type: '',
              size: 0,
              created_at: new Date().toISOString(),
              user_id: user?.id,
              source: 'booking_request'
            };
            
            setDisplayedFiles(prev => [...prev, bookingFile]);
          }
          
          console.log("Checking booking_files table for booking ID:", event.booking_request_id);
          const { data: bookingFilesData, error: bookingFilesError } = await supabase
            .from("booking_files")
            .select("*")
            .eq("booking_id", event.booking_request_id);
            
          if (bookingFilesError) {
            console.error("Error checking booking_files table:", bookingFilesError);
          } else if (bookingFilesData && bookingFilesData.length > 0) {
            console.log("Found files in booking_files table:", bookingFilesData);
            
            const mappedFiles = bookingFilesData.map(file => ({
              id: `booking-file-${file.id}`,
              event_id: event.id,
              filename: file.filename || 'attachment',
              file_path: file.file_path,
              content_type: file.content_type || '',
              size: file.size || 0,
              created_at: file.created_at || new Date().toISOString(),
              user_id: user?.id,
              source: 'booking_files'
            }));
            
            setDisplayedFiles(prev => [...prev, ...mappedFiles]);
          }
        }
        
        if (event.type === 'booking_request') {
          console.log("Loading files for booking request:", event.id);
          
          const { data: bookingData, error: bookingError } = await supabase
            .from('booking_requests')
            .select('file_path, filename')
            .eq('id', event.id)
            .maybeSingle();
            
          if (bookingError) {
            console.error("Error loading booking request file data:", bookingError);
          }
          
          if (!bookingError && bookingData && bookingData.file_path) {
            console.log("Found booking file:", bookingData);
            
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
            
            setDisplayedFiles(prev => [...prev, bookingFile]);
          } 
          
          console.log("Checking booking_files table for booking ID:", event.id);
          const { data: bookingFilesData, error: bookingFilesError } = await supabase
            .from("booking_files")
            .select("*")
            .eq("booking_id", event.id);
            
          if (bookingFilesError) {
            console.error("Error checking booking_files table:", bookingFilesError);
          } else if (bookingFilesData && bookingFilesData.length > 0) {
            console.log("Found files in booking_files table:", bookingFilesData);
            
            const mappedFiles = bookingFilesData.map(file => ({
              id: `booking-file-${file.id}`,
              event_id: event.id,
              filename: file.filename || 'attachment',
              file_path: file.file_path,
              content_type: file.content_type || '',
              size: file.size || 0,
              created_at: file.created_at || new Date().toISOString(),
              user_id: user?.id,
              source: 'booking_files'
            }));
            
            setDisplayedFiles(prev => [...prev, ...mappedFiles]);
          }
        }
        
        const { data: eventFilesData, error: eventFilesError } = await supabase
          .from('event_files')
          .select('*')
          .eq('event_id', event.id);
          
        if (eventFilesError) {
          console.error("Error loading event files:", eventFilesError);
        } else if (eventFilesData && eventFilesData.length > 0) {
          console.log("Found event files in event_files table:", eventFilesData);
          const mappedEventFiles = eventFilesData.map(file => ({
            ...file,
            source: file.source || 'event'
          }));
          setDisplayedFiles(prev => [...prev, ...mappedEventFiles]);
        }
        
        console.log("Total files found:", displayedFiles.length);
      } catch (err) {
        console.error("Exception loading event files:", err);
      }
    };
    
    if (open && event?.id) {
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
    }

    if (wasBookingRequest) {
      eventData.type = 'event';
      eventData.booking_request_id = event.id;
      console.log("Converting booking request to event:", { wasBookingRequest, isApprovingBookingRequest, bookingId: event.id });
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

      if (!isBookingEvent) {
        if (selectedFile && createdEvent?.id && user) {
          try {
            await uploadFileToEvent(selectedFile, createdEvent.id, user.id);
            console.log("Successfully uploaded new file for event:", createdEvent.id);
          } catch (fileError) {
            console.error("Error handling file upload:", fileError);
          }
        }
        
        if (wasBookingRequest && event?.id && createdEvent?.id) {
          console.log("Looking up existing files from booking request:", event.id);
          
          if (event.file_path) {
            try {
              console.log("Found direct file on event:", event.file_path);
              const { error: fileError } = await supabase
                .from('event_files')
                .insert({
                  event_id: createdEvent.id,
                  filename: event.filename || 'attachment',
                  file_path: event.file_path,
                  content_type: 'application/octet-stream',
                  size: 0,
                  user_id: user?.id,
                  source: 'booking_request'
                });
                
              if (fileError) {
                console.error("Error linking direct event file:", fileError);
              } else {
                console.log("Successfully linked direct event file");
              }
            } catch (err) {
              console.error("Error processing direct event file:", err);
            }
          }

          try {
            const { data: bookingData, error: bookingError } = await supabase
              .from('booking_requests')
              .select('file_path, filename')
              .eq('id', event.id)
              .maybeSingle();
              
            if (bookingError) {
              console.error("Error fetching booking data:", bookingError);
            } else if (bookingData?.file_path) {
              console.log("Found file in booking_requests:", bookingData);
              
              const { error: fileError } = await supabase
                .from('event_files')
                .insert({
                  event_id: createdEvent.id,
                  filename: bookingData.filename || 'attachment',
                  file_path: bookingData.file_path,
                  content_type: 'application/octet-stream',
                  size: 0,
                  user_id: user?.id,
                  source: 'booking_request'
                });
                
              if (fileError) {
                console.error("Error linking booking file:", fileError);
              } else {
                console.log("Successfully linked booking file");
              }
            }
          } catch (err) {
            console.error("Error processing booking files:", err);
          }
          
          try {
            const { data: bookingFilesData, error: bookingFilesError } = await supabase
              .from("booking_files")
              .select("*")
              .eq("booking_id", event.id);
              
            if (bookingFilesError) {
              console.error("Error checking booking_files table:", bookingFilesError);
            } else if (bookingFilesData && bookingFilesData.length > 0) {
              console.log("Found files in booking_files table:", bookingFilesData);
              
              for (const file of bookingFilesData) {
                const { error: fileError } = await supabase
                  .from('event_files')
                  .insert({
                    event_id: createdEvent.id,
                    filename: file.filename || 'attachment',
                    file_path: file.file_path,
                    content_type: file.content_type || 'application/octet-stream',
                    size: file.size || 0,
                    user_id: user?.id,
                    source: 'booking_files'
                  });
                  
                if (fileError) {
                  console.error("Error linking booking_file to event_files:", fileError);
                } else {
                  console.log("Successfully linked file from booking_files to event_files");
                }
              }
            }
          } catch (err) {
            console.error("Error processing booking_files:", err);
          }

          if (wasBookingRequest) {
            try {
              let filePathToUse = event.file_path || null;
              let filenameToUse = event.filename || null;
              
              if (!filePathToUse) {
                const { data: bookingFilesData } = await supabase
                  .from("booking_files")
                  .select("file_path, filename")
                  .eq("booking_id", event.id)
                  .maybeSingle();
                  
                if (bookingFilesData) {
                  filePathToUse = bookingFilesData.file_path;
                  filenameToUse = bookingFilesData.filename;
                  console.log("Found file in booking_files for customer creation:", filePathToUse);
                }
              }
              
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
                create_event: false,
                file_path: filePathToUse,
                filename: filenameToUse
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
                console.log("Created customer, linking file:", newCustomer);
                
                if (filePathToUse) {
                  const { error: customerFileError } = await supabase
                    .from('customer_files_new')
                    .insert({
                      customer_id: newCustomer.id,
                      filename: filenameToUse || 'attachment',
                      file_path: filePathToUse,
                      content_type: 'application/octet-stream',
                      size: 0,
                      user_id: user?.id,
                      source: 'booking_request'
                    });
                  
                  if (customerFileError) {
                    console.error("Error creating file record for customer:", customerFileError);
                  } else {
                    console.log("Successfully created file record for customer");
                  }
                }

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

  const uploadFileToEvent = async (file: File, eventId: string, userId: string) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${crypto.randomUUID()}.${fileExt}`;
    
    console.log('Uploading file to event_attachments:', filePath);
    
    const { error: uploadError } = await supabase.storage
      .from('event_attachments')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    console.log('File uploaded successfully, creating record in event_files');
    const { error: fileRecordError } = await supabase
      .from('event_files')
      .insert({
        event_id: eventId,
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
        user_id: userId,
        source: 'event'
      });
      
    if (fileRecordError) {
      console.error('Error creating file record:', fileRecordError);
      throw fileRecordError;
    }

    console.log('File record created successfully');
    
    queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
    
    return true;
  };

  const handleFileDeleted = (fileId: string) => {
    console.log("File deleted, removing from displayed files:", fileId);
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
