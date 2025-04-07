// Import necessary components and functions
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  event?: CalendarEventType;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onDelete?: (id: string) => Promise<void>;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  event,
  onSubmit,
  onDelete,
}: EventDialogProps) => {
  // Set up state for event data
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();
  const { t, language } = useLanguage();

  // Enhanced query for event files to properly handle both booking files and event files
  const {
    data: eventFiles = [],
    isLoading: isLoadingFiles,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ["event-files", event?.id, event?.booking_request_id],
    queryFn: async () => {
      if (!event?.id && !event?.booking_request_id) return [];
      
      console.log("EventDialog - Fetching files for event:", { 
        id: event.id, 
        type: event.type, 
        booking_request_id: event.booking_request_id 
      });
      
      let fileList = [];
      
      // Improved approach: First check for booking files in all possible locations
      if (event.booking_request_id) {
        // Case 1: Event created from a booking request (has booking_request_id)
        console.log("Case 1: Checking booking files for booking_request_id:", event.booking_request_id);
        
        const { data: bookingFiles, error: bookingFilesError } = await supabase
          .from("booking_files")
          .select("*")
          .eq("booking_id", event.booking_request_id);
          
        if (bookingFilesError) {
          console.error("Error fetching booking files:", bookingFilesError);
        } else if (bookingFiles && bookingFiles.length > 0) {
          console.log("Found booking files with booking_request_id:", bookingFiles.length);
          
          fileList = bookingFiles.map(file => ({
            id: file.file_path,
            filename: file.filename,
            content_type: file.content_type,
            source: 'booking_attachments'
          }));
        }
      } 
      else if (event.type === 'booking_request' && event.id) {
        // Case 2: This is a booking request event (pending, not yet approved)
        console.log("Case 2: Checking booking files for booking event id:", event.id);
        
        const { data: bookingFiles, error: bookingFilesError } = await supabase
          .from("booking_files")
          .select("*")
          .eq("booking_id", event.id);
          
        if (bookingFilesError) {
          console.error("Error fetching booking files (from ID):", bookingFilesError);
        } else if (bookingFiles && bookingFiles.length > 0) {
          console.log("Found booking files with event id:", bookingFiles.length);
          
          fileList = bookingFiles.map(file => ({
            id: file.file_path,
            filename: file.filename,
            content_type: file.content_type,
            source: 'booking_attachments'
          }));
        }
      }
      
      // Case 3: Always check for event files if we have an event ID
      if (event.id) {
        console.log("Case 3: Checking event_files for event ID:", event.id);
        
        const { data: eventFilesData, error: eventFilesError } = await supabase
          .from("event_files")
          .select("*")
          .eq("event_id", event.id);
          
        if (eventFilesError) {
          console.error("Error fetching event files:", eventFilesError);
        } else if (eventFilesData && eventFilesData.length > 0) {
          console.log("Found event_files:", eventFilesData.length);
          
          // Only add files that aren't already in the list
          const existingPaths = new Set(fileList.map(f => f.id));
          const newFiles = eventFilesData
            .filter(file => !existingPaths.has(file.file_path))
            .map(file => ({
              id: file.file_path,
              filename: file.filename,
              content_type: file.content_type,
              source: 'event_attachments'
            }));
          
          fileList = [...fileList, ...newFiles];
        }
      }
      
      console.log("Final file list for event dialog:", fileList);
      return fileList;
    },
    enabled: open && (!!event?.id || !!event?.booking_request_id),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });

  // Set initial values when dialog opens or event changes
  useEffect(() => {
    if (open) {
      if (event) {
        setUserSurname(event.user_surname || event.requester_name || "");
        setUserNumber(event.user_number || event.requester_phone || "");
        setSocialNetworkLink(event.social_network_link || event.requester_email || "");
        setEventNotes(event.event_notes || event.description || "");
        setStartDate(event.start_date || "");
        setEndDate(event.end_date || "");
        setPaymentStatus(event.payment_status || "not_paid");
        setPaymentAmount(event.payment_amount?.toString() || "");
        
        // Log event data for debugging
        console.log("Event data being loaded:", {
          id: event.id,
          type: event.type,
          status: event.status,
          booking_request_id: event.booking_request_id
        });
        
        // Force refetch of files
        refetchFiles();
      } else if (selectedDate) {
        const formattedDate = format(selectedDate, "yyyy-MM-dd'T'HH:mm");
        const endDateValue = new Date(selectedDate);
        endDateValue.setHours(endDateValue.getHours() + 1);
        
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setStartDate(formattedDate);
        setEndDate(format(endDateValue, "yyyy-MM-dd'T'HH:mm"));
        setPaymentStatus("not_paid");
        setPaymentAmount("");
      }
    } else {
      setSelectedFile(null);
      setFileError("");
    }
  }, [open, event, selectedDate, refetchFiles]);

  const handleSubmit = async () => {
    try {
      // Validate customer name
      if (!userSurname) {
        toast({
          title: "Error",
          description: "Please enter a customer name",
          variant: "destructive",
        });
        return;
      }

      if (!startDate || !endDate) {
        toast({
          title: "Error",
          description: "Please select start and end dates",
          variant: "destructive",
        });
        return;
      }

      // Make sure start date is before end date
      if (new Date(startDate) >= new Date(endDate)) {
        toast({
          title: "Error",
          description: "End date must be after start date",
          variant: "destructive",
        });
        return;
      }

      // Validate payment amount if payment status is not "not_paid"
      if (paymentStatus !== "not_paid" && !paymentAmount) {
        toast({
          title: "Error",
          description: "Please enter payment amount",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);

      // Use customer name as the title
      const eventTitle = userSurname;

      // Prepare event data for submission
      const eventData: Partial<CalendarEventType> = {
        title: eventTitle,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: paymentStatus !== "not_paid" ? parseFloat(paymentAmount) : undefined,
        type: event?.type || "private_party",
      };

      // If this is an update and we have an ID, include it
      if (event?.id) {
        eventData.id = event.id;
      }
      
      // Preserve booking_request_id and status when updating
      if (event?.booking_request_id) {
        eventData.booking_request_id = event.booking_request_id;
      }
      
      // Preserve status when updating
      if (event?.status) {
        eventData.status = event.status;
      }

      console.log("Submitting event data:", eventData);

      // Submit event data
      const savedEvent = await onSubmit(eventData);

      // Upload file if one is selected
      if (selectedFile) {
        // Upload file to Supabase Storage
        const fileName = `${Date.now()}-${selectedFile.name}`;
        const filePath = `${savedEvent.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("event_attachments")
          .upload(filePath, selectedFile);
          
        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          toast({
            title: "Error",
            description: "Failed to upload file. Event was saved.",
            variant: "destructive",
          });
        } else {
          // Create file record in the database
          const { error: fileRecordError } = await supabase
            .from("event_files")
            .insert({
              event_id: savedEvent.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size,
              user_id: savedEvent.user_id
            });
            
          if (fileRecordError) {
            console.error("Error creating file record:", fileRecordError);
          }
        }
      }

      toast({
        title: event ? "Event updated" : "Event created",
        description: event
          ? "Your event has been updated successfully."
          : "Your event has been added to the calendar.",
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    
    try {
      setIsSubmitting(true);
      await onDelete(event.id);
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enhanced file deletion function that handles both booking files and event files
  const handleFileDeleted = async (fileId: string) => {
    try {
      console.log("Handling file deletion for:", fileId);
      
      // Get the file metadata first to determine its source
      const fileMetadata = eventFiles.find(file => file.id === fileId);
      if (!fileMetadata) {
        throw new Error("File metadata not found");
      }
      
      const fileSource = fileMetadata.source || 
        (fileId.includes('booking_attachments') ? 'booking_attachments' : 'event_attachments');
      
      console.log("File source determined as:", fileSource);
      
      if (fileSource === 'booking_attachments') {
        // Handle booking file deletion
        console.log("Handling deletion of booking file:", fileId);
        
        // Get the booking ID - either from booking_request_id or from event.id for pending bookings
        const bookingId = event?.booking_request_id || (event?.type === 'booking_request' ? event.id : null);
        
        if (!bookingId) {
          console.error("Cannot determine booking ID for file deletion");
          throw new Error("Cannot determine booking ID");
        }
        
        // Delete the record from booking_files
        const { error: fileRecordError } = await supabase
          .from("booking_files")
          .delete()
          .eq("file_path", fileId);
          
        if (fileRecordError) {
          console.error("Error deleting booking file record:", fileRecordError);
          throw fileRecordError;
        }
        
        // Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from("booking_attachments")
          .remove([fileId]);
          
        if (storageError) {
          console.error("Error deleting booking file from storage:", storageError);
          throw storageError;
        }
      } else {
        // Handle event file deletion
        console.log("Handling deletion of event file:", fileId);
        
        // Delete the record from event_files
        const { error: fileRecordError } = await supabase
          .from("event_files")
          .delete()
          .eq("file_path", fileId);
          
        if (fileRecordError) {
          console.error("Error deleting event file record:", fileRecordError);
          throw fileRecordError;
        }
        
        // Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from("event_attachments")
          .remove([fileId]);
          
        if (storageError) {
          console.error("Error deleting event file from storage:", storageError);
          throw storageError;
        }
      }
      
      // Refresh files list
      refetchFiles();
      
      toast({
        title: "Success",
        description: "File deleted successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  // Get button text based on state
  const getButtonText = () => {
    if (isSubmitting) {
      return 'Saving...';
    }
    if (event) {
      return 'Update';
    }
    return 'Create';
  };

  console.log("EventDialog - Files to display:", eventFiles);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {event ? 'Edit Event' : 'Add Event'}
            </DialogTitle>
          </DialogHeader>

          <EventDialogFields
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
            displayedFiles={eventFiles}
            isBookingRequest={event?.type === 'booking_request'}
          />

          <DialogFooter className="gap-2 sm:gap-0">
            {event && onDelete && (
              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Confirm Deletion
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this event?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {getButtonText()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
