import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultEndDate?: Date | null;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType | undefined>;
  onDelete?: () => void;
  event?: CalendarEventType;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  onDelete,
  event,
}: EventDialogProps) => {
  const [title, setTitle] = useState(event?.title || "");
  const [userNumber, setUserNumber] = useState(event?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(event?.social_network_link || "");
  const [eventNotes, setEventNotes] = useState(event?.event_notes || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(event?.payment_status || "");
  const [paymentAmount, setPaymentAmount] = useState(event?.payment_amount?.toString() || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (event) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    } else if (selectedDate) {
      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      end.setHours(start.getHours() + 1);
      
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [selectedDate, event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let uploadedFilePath: string | null = null;
    
    try {
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      
      const eventData = {
        title,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        payment_status: paymentStatus || null,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
      };

      console.log('Submitting event with data:', eventData);
      const result = await onSubmit(eventData);

      if (selectedFile && result?.id) {
        console.log('Starting file upload for event:', result.id);
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        uploadedFilePath = filePath;
        
        console.log('Uploading file to storage:', filePath);
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('File upload error:', uploadError);
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        console.log('File uploaded successfully, creating database record');
        const { error: fileRecordError } = await supabase
          .from('event_files')
          .insert({
            event_id: result.id,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
          });

        if (fileRecordError) {
          // If database insert fails, try to clean up the uploaded file
          if (uploadedFilePath) {
            await supabase.storage
              .from('event_attachments')
              .remove([uploadedFilePath]);
          }
          console.error('File record error:', fileRecordError);
          throw new Error(`Failed to save file record: ${fileRecordError.message}`);
        }

        // Invalidate the files query to trigger a refresh
        await queryClient.invalidateQueries({ queryKey: ['eventFiles', result.id] });
        console.log('File record created successfully');
      }

      toast({
        title: "Success",
        description: "Event and file saved successfully",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      // If there was an error and we uploaded a file, try to clean it up
      if (uploadedFilePath) {
        try {
          await supabase.storage
            .from('event_attachments')
            .remove([uploadedFilePath]);
        } catch (cleanupError) {
          console.error('Failed to clean up uploaded file:', cleanupError);
        }
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{event ? "Edit Event" : "Add New Event"}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <EventDialogFields
            title={title}
            setTitle={setTitle}
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
          />
          
          <div className="flex justify-between gap-4">
            <Button type="submit" className="flex-1">
              {event ? "Update Event" : "Create Event"}
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