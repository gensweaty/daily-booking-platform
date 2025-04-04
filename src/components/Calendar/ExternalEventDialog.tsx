
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { EventDialogFields } from "./EventDialogFields";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExternalEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultEndDate?: Date | null;
  businessId: string;
  onSuccess?: () => void;
}

export const ExternalEventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  businessId,
  onSuccess
}: ExternalEventDialogProps) => {
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      const start = new Date(selectedDate.getTime());
      const end = new Date(selectedDate.getTime());
      
      // If hour isn't set in the selected date, default to business hours
      if (start.getHours() === 0 && start.getMinutes() === 0) {
        start.setHours(9, 0, 0, 0);
        end.setHours(10, 0, 0, 0);
      } else {
        // If hour is set, just add 1 hour for the end time
        end.setHours(end.getHours() + 1);
      }
      
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [selectedDate, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      console.log("Submitting external event request");
      
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      
      // First, check if the time slot is available
      const { data: conflictingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .filter('start_date', 'lt', endDateTime.toISOString())
        .filter('end_date', 'gt', startDateTime.toISOString());
      
      if (eventsError) throw eventsError;
      
      if (conflictingEvents && conflictingEvents.length > 0) {
        toast({
          title: t("common.error"),
          description: t("events.timeSlotNotAvailable"),
          variant: "destructive",
        });
        return;
      }
      
      // Create an event request rather than a direct event
      const eventData = {
        title,
        requester_name: userSurname,
        requester_phone: userNumber,
        requester_email: socialNetworkLink,
        description: eventNotes,
        business_id: businessId,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        status: 'pending'
      };
      
      // Find the business owner's user ID 
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('user_id')
        .eq('id', businessId)
        .single();
      
      if (businessError) throw businessError;
      
      // Insert the booking request
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .insert([eventData])
        .select()
        .single();
      
      if (bookingError) throw bookingError;
      
      console.log("Successfully created booking request:", bookingData);
      
      // If we have a file, upload it and associate with the booking request
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        console.log('Uploading file:', filePath);
        
        const { error: uploadError } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          // Don't throw - we still created the booking
        } else {
          // Create file record
          const { error: fileRecordError } = await supabase
            .from('booking_files')
            .insert({
              booking_id: bookingData.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size
            });

          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
          }
        }
      }
      
      toast({
        title: t("common.success"),
        description: t("events.bookingRequestSubmitted"),
      });
      
      onOpenChange(false);
      if (onSuccess) onSuccess();
      
      // Reset form
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setSelectedFile(null);
      
    } catch (error: any) {
      console.error('Error submitting event request:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.error"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t("events.requestBooking")}</DialogTitle>
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
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            isExternalRequest={true}
          />
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.submitting") : t("events.submitBookingRequest")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
