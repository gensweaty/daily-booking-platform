
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
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
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
      setIsBookingEvent(event.type === 'booking_request');
      
      if (event.file_path || event.filename) {
        console.log("Event with file attachment:", {
          id: event.id,
          title: event.title,
          file_path: event.file_path,
          filename: event.filename
        });
      }
    } else if (selectedDate) {
      const start = new Date(selectedDate.getTime());
      const end = new Date(selectedDate.getTime());
      
      start.setHours(9, 0, 0, 0);
      end.setHours(10, 0, 0, 0);
      
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [selectedDate, event, open]);

  useEffect(() => {
    const loadFiles = async () => {
      if (event?.id && open) {
        try {
          console.log("Loading files for event ID:", event.id, "Type:", event.type);
          
          const isBookingRequest = event.id.includes('-') || event.type === 'booking_request';
          console.log("Is booking request:", isBookingRequest);
          
          // Search event_files for files linked to this event/booking ID
          const { data: eventFiles, error: eventFilesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', event.id);
            
          if (eventFilesError) {
            console.error("Error loading event files:", eventFilesError);
            return;
          }
          
          if (eventFiles && eventFiles.length > 0) {
            console.log("Loaded files for ID:", event.id, eventFiles);
            setDisplayedFiles(eventFiles);
          } else {
            console.log("No direct event files found for ID:", event.id);
            
            // If this is a booking request that was approved
            if (isBookingRequest) {
              console.log("This is an approved booking request, checking for additional file sources");
              
              // Try to find files attached to the booking request or related customer
              const { data: relatedFiles, error: relatedError } = await supabase.rpc('get_all_related_files', {
                event_id_param: event.id,
                entity_name_param: event.title
              });
              
              if (relatedError) {
                console.error("Error checking related files:", relatedError);
              } else if (relatedFiles && relatedFiles.length > 0) {
                console.log("Found related files:", relatedFiles);
                setDisplayedFiles(relatedFiles);
              } else {
                console.log("No related files found");
              }
            }
          }
        } catch (err) {
          console.error("Exception loading event files:", err);
        }
      }
    };
    
    if (open) {
      setSelectedFile(null);
      setFileError("");
      loadFiles();
    }
  }, [event, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    
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
      if (isBookingEvent || event.type === 'booking_request') {
        eventData.type = 'booking_request';
      }
    }

    try {
      const createdEvent = await onSubmit(eventData);
      console.log('Created/Updated event:', createdEvent);

      // Get the correct event ID - use either the updated event ID or the original event ID
      const eventId = event?.id || createdEvent?.id;

      if (selectedFile && eventId && user) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        console.log('Uploading file for event ID:', eventId, filePath);
        
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
          event_id: eventId // Using the correct event ID
        };

        console.log('Inserting file record into event_files:', fileData);
        
        const { data: createdFile, error: fileError } = await supabase
          .from('event_files')
          .insert(fileData)
          .select()
          .single();
          
        if (fileError) {
          console.error('Error creating file record:', fileError);
          throw fileError;
        }
        
        console.log('File record created successfully in event_files:', createdFile);
      }

      // Handle customer creation/update for regular events
      if (!isBookingEvent) {
        const { data: existingCustomer, error: customerQueryError } = await supabase
          .from('customers')
          .select('id')
          .eq('title', title)
          .maybeSingle();

        if (customerQueryError && customerQueryError.code !== 'PGRST116') {
          console.error('Error checking for existing customer:', customerQueryError);
          throw customerQueryError;
        }

        let customerId;
        
        if (!existingCustomer) {
          console.log('Creating new customer record for:', title);
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              title,
              user_surname: userSurname,
              user_number: userNumber,
              social_network_link: socialNetworkLink,
              event_notes: eventNotes,
              payment_status: paymentStatus || null,
              payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
              start_date: startDateTime.toISOString(),
              end_date: endDateTime.toISOString(),
              user_id: user?.id,
              type: 'customer'
            })
            .select()
            .single();

          if (customerError) {
            console.error('Error creating new customer:', customerError);
            throw customerError;
          }
          customerId = newCustomer.id;
          console.log('Created new customer:', newCustomer);
        } else {
          customerId = existingCustomer.id;
          
          console.log('Updating existing customer:', customerId);
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              user_surname: userSurname,
              user_number: userNumber,
              social_network_link: socialNetworkLink,
              event_notes: eventNotes,
              payment_status: paymentStatus || null,
              payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
              start_date: startDateTime.toISOString(),
              end_date: endDateTime.toISOString(),
            })
            .eq('id', customerId);

          if (updateError) {
            console.error('Error updating customer:', updateError);
            throw updateError;
          }
          console.log('Updated existing customer:', customerId);
        }

        // Copy files from event to customer if there's a new file upload
        if (selectedFile && user && customerId) {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${crypto.randomUUID()}.${fileExt}`;
          
          console.log('Adding new file to customer record:', customerId);
          
          // Upload the file to storage (reusing the file that was just uploaded)
          const originalFilePath = `${crypto.randomUUID()}.${fileExt}`;
          await supabase.storage
            .from('event_attachments')
            .upload(originalFilePath, selectedFile);
          
          // Create entry in customer_files_new
          const { error: customerFileError } = await supabase
            .from('customer_files_new')
            .insert({
              filename: selectedFile.name,
              file_path: originalFilePath, // Store the new file path
              content_type: selectedFile.type,
              size: selectedFile.size,
              user_id: user.id,
              customer_id: customerId
            });
            
          if (customerFileError) {
            console.error('Error creating customer file record:', customerFileError);
          } else {
            console.log('Customer file record created successfully');
          }
        }
        
        // Also copy any existing files from event to customer
        // This is crucial for external booking request files
        if (customerId) {
          try {
            console.log('Checking for existing files from event to copy to customer');
            // First get all files for this event
            const { data: existingFiles, error: filesError } = await supabase
              .from('event_files')
              .select('*')
              .eq('event_id', eventId);
              
            if (filesError) {
              console.error('Error fetching existing event files:', filesError);
            } else if (existingFiles && existingFiles.length > 0) {
              console.log(`Found ${existingFiles.length} files to copy to customer`);
              
              for (const file of existingFiles) {
                // Check if this file is already linked to the customer
                const { data: existingCustomerFile } = await supabase
                  .from('customer_files_new')
                  .select('id')
                  .eq('file_path', file.file_path)
                  .eq('customer_id', customerId)
                  .maybeSingle();
                  
                if (!existingCustomerFile) {
                  console.log(`Copying file ${file.filename} to customer ${customerId}`);
                  
                  // Copy the file record to customer_files_new
                  const { error: copyError } = await supabase
                    .from('customer_files_new')
                    .insert({
                      filename: file.filename,
                      file_path: file.file_path,
                      content_type: file.content_type,
                      size: file.size,
                      user_id: user.id,
                      customer_id: customerId
                    });
                    
                  if (copyError) {
                    console.error('Error copying file to customer:', copyError);
                  } else {
                    console.log(`Successfully copied file ${file.filename} to customer ${customerId}`);
                  }
                } else {
                  console.log(`File ${file.filename} already exists for customer ${customerId}`);
                }
              }
            } else {
              console.log('No event files found to copy to customer');
              
              // Special case: Check if files were attached to booking request and copy them
              if (event && (event.type === 'booking_request' || isBookingEvent)) {
                console.log('This is a booking request event, checking for booking files');
                
                // Query files from booking_request_files view or check other sources
                // where files might be linked with this event's information
                const { data: bookingFiles, error: bookingFilesError } = await supabase.rpc('get_booking_request_files', {
                  booking_id_param: event.id
                });
                
                if (bookingFilesError) {
                  console.error('Error checking booking files:', bookingFilesError);
                } else if (bookingFiles && bookingFiles.length > 0) {
                  console.log(`Found ${bookingFiles.length} booking files to copy to customer`);
                  
                  for (const file of bookingFiles) {
                    console.log(`Copying booking file ${file.filename} to customer ${customerId}`);
                    
                    // Check if this file is already linked to the customer
                    const { data: existingCustomerFile } = await supabase
                      .from('customer_files_new')
                      .select('id')
                      .eq('file_path', file.file_path)
                      .eq('customer_id', customerId)
                      .maybeSingle();
                      
                    if (!existingCustomerFile) {
                      // Copy the file record to customer_files_new
                      const { error: copyError } = await supabase
                        .from('customer_files_new')
                        .insert({
                          filename: file.filename,
                          file_path: file.file_path,
                          content_type: file.content_type || 'application/octet-stream',
                          size: file.size || 0,
                          user_id: user.id,
                          customer_id: customerId
                        });
                        
                      if (copyError) {
                        console.error('Error copying booking file to customer:', copyError);
                      } else {
                        console.log(`Successfully copied booking file ${file.filename} to customer ${customerId}`);
                      }
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error('Error copying files to customer:', err);
          }
        }

        toast({
          title: t("common.success"),
          description: t("common.success"),
        });
      } else if (isBookingEvent && event?.id) {
        // Update booking request if this is a booking event
        const { data: bookingRequest, error: findError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('id', event.id)
          .maybeSingle();
            
        if (!findError && bookingRequest) {
          console.log('Updating booking request:', event.id);
          
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
              payment_status: paymentStatus || 'not_paid',
              payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
            })
            .eq('id', event.id);
              
          if (updateError) {
            console.error('Error updating booking request:', updateError);
          } else {
            console.log('Updated booking request successfully');
            
            // Update matching customer if one exists
            const { data: matchingCustomer } = await supabase
              .from('customers')
              .select('id')
              .eq('title', title)
              .maybeSingle();
              
            if (matchingCustomer) {
              console.log('Found matching customer for booking request:', matchingCustomer.id);
              
              // Update the customer with the same details
              const { error: customerUpdateError } = await supabase
                .from('customers')
                .update({
                  user_surname: userSurname,
                  user_number: userNumber,
                  social_network_link: socialNetworkLink,
                  event_notes: eventNotes,
                  start_date: startDateTime.toISOString(),
                  end_date: endDateTime.toISOString(),
                  payment_status: paymentStatus || 'not_paid',
                  payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
                })
                .eq('id', matchingCustomer.id);
                
              if (customerUpdateError) {
                console.error('Error updating matching customer:', customerUpdateError);
              } else {
                console.log('Updated matching customer successfully');
              }
            }
          }
        }
      }

      onOpenChange(false);
      
      // Invalidate all relevant queries to refresh data
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
            dialogOpen={open}
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
