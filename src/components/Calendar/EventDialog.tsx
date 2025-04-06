
// Modify EventDialog.tsx to display files attached to the event
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { format } from "date-fns";
import { EventDialogFields } from "./EventDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FileDisplay } from "../shared/FileDisplay";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  event?: CalendarEventType;
  onSubmit?: (data: Partial<CalendarEventType>) => Promise<any>;
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
  const [title, setTitle] = useState("");
  const [surname, setSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>("not_paid");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [eventFiles, setEventFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  // Initialize form with event data or default values
  useEffect(() => {
    if (event) {
      setTitle(event.title || "");
      setSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setStartDate(
        event.start_date
          ? new Date(event.start_date).toISOString().slice(0, 16)
          : ""
      );
      setEndDate(
        event.end_date
          ? new Date(event.end_date).toISOString().slice(0, 16)
          : ""
      );
      setPaymentStatus(event.payment_status || "not_paid");
      setPaymentAmount(
        event.payment_amount ? event.payment_amount.toString() : ""
      );
      
      // Fetch event files
      fetchEventFiles(event.id);
    } else if (selectedDate) {
      // Set default values for new event
      const defaultStartDate = new Date(selectedDate);
      defaultStartDate.setHours(defaultStartDate.getHours(), 0, 0, 0);
      
      const defaultEndDate = new Date(selectedDate);
      defaultEndDate.setHours(defaultEndDate.getHours() + 1, 0, 0, 0);
      
      setStartDate(defaultStartDate.toISOString().slice(0, 16));
      setEndDate(defaultEndDate.toISOString().slice(0, 16));
      setTitle("");
      setSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setEventFiles([]);
    }
  }, [event, selectedDate, open]);

  const fetchEventFiles = async (eventId: string) => {
    setIsLoading(true);
    try {
      // First check if this is a booking request event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('booking_request_id')
        .eq('id', eventId)
        .single();
        
      if (eventError) {
        console.error('Error fetching event data:', eventError);
      } else if (eventData?.booking_request_id) {
        // It's a booking request event, check booking_files
        const bookingId = eventData.booking_request_id;
        console.log('Fetching files for booking ID:', bookingId);
        
        const { data: bookingFiles, error: bookingFilesError } = await supabase
          .from('booking_files')
          .select('*')
          .eq('booking_id', bookingId);
          
        if (bookingFilesError) {
          console.error('Error fetching booking files:', bookingFilesError);
        } else if (bookingFiles && bookingFiles.length > 0) {
          console.log('Found booking files:', bookingFiles);
          setEventFiles(bookingFiles.map(file => ({
            id: file.file_path,
            filename: file.filename,
            content_type: file.content_type,
            source: 'booking_attachments'
          })));
          setIsLoading(false);
          return;
        }
      }
      
      // If not a booking event or no booking files found, check event_files
      console.log('Fetching files for event ID:', eventId);
      const { data: files, error: filesError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', eventId);
        
      if (filesError) {
        console.error('Error fetching event files:', filesError);
      } else if (files && files.length > 0) {
        console.log('Found event files:', files);
        setEventFiles(files.map(file => ({
          id: file.file_path,
          filename: file.filename,
          content_type: file.content_type,
          source: 'event_attachments'
        })));
      } else {
        setEventFiles([]);
      }
    } catch (error) {
      console.error('Error in fetchEventFiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) return;

    try {
      setIsSubmitting(true);

      const eventData: Partial<CalendarEventType> = {
        ...(event?.id ? { id: event.id } : {}),
        title,
        user_surname: surname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        start_date: startDate,
        end_date: endDate,
        type: event?.type || "event",
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        status: event?.status
      };

      const result = await onSubmit(eventData);

      // Handle file upload if a file is selected and we have an event ID
      if (selectedFile && result?.id) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        // Upload file to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          toast({
            title: "File Upload Error",
            description: uploadError.message,
            variant: "destructive",
          });
        } else {
          // Create file record in database
          const fileData = {
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            event_id: result.id
          };

          const { error: fileRecordError } = await supabase
            .from('event_files')
            .insert([fileData]);

          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
            toast({
              title: "File Record Error",
              description: fileRecordError.message,
              variant: "destructive",
            });
          }
        }
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error submitting event:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || !onDelete) return;

    try {
      setIsSubmitting(true);
      await onDelete(event.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileDeleted = async (fileId: string) => {
    try {
      console.log('Deleting file:', fileId);
      
      // Delete the file record from the database first
      const { error: dbError } = await supabase
        .from('event_files')
        .delete()
        .eq('file_path', fileId);

      if (dbError) {
        console.error('Error deleting file record:', dbError, fileId);
        throw dbError;
      }
      
      console.log('File record deleted from database');
      
      // Delete the file from storage next
      const { data: deleteData, error: storageError } = await supabase.storage
        .from('event_attachments')
        .remove([fileId]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError, fileId);
        throw storageError;
      }
      
      console.log('File deleted from storage:', deleteData);

      // Update the local state
      setEventFiles(prev => prev.filter(file => file.id !== fileId));

      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return "";
    try {
      return format(new Date(dateString), "PPpp");
    } catch (e) {
      return dateString;
    }
  };

  const dialogTitle = event?.id ? "Edit Event" : "Create Event";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <EventDialogFields
            title={title}
            setTitle={setTitle}
            surname={surname}
            setSurname={setSurname}
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
          />
          
          {/* Display attached files */}
          {eventFiles.length > 0 && (
            <div className="mb-4">
              <Card className="p-4">
                <Label className="mb-2 block">Attached Files</Label>
                <FileDisplay 
                  files={eventFiles} 
                  bucketName={eventFiles[0].source === 'booking_attachments' ? 'booking_attachments' : 'event_attachments'}
                  source={eventFiles[0].source}
                  allowDelete={eventFiles[0].source === 'event_attachments'}
                  onFileDeleted={handleFileDeleted}
                />
              </Card>
            </div>
          )}

          <DialogFooter>
            {event?.id && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
