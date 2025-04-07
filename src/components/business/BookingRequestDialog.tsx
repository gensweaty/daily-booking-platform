
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventDialogFields } from "../Calendar/EventDialogFields";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { createBookingRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";

interface BookingRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  selectedDate: Date | null;
  startTime?: string;
  endTime?: string;
  onSuccess?: () => void;
}

export const BookingRequestDialog = ({
  open,
  onOpenChange,
  businessId,
  selectedDate,
  startTime,
  endTime,
  onSuccess
}: BookingRequestDialogProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  // States for EventDialogFields component
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  
  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when dialog closes
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setSelectedFile(null);
      setFileError("");
    } else {
      // Initialize dates when dialog opens
      const start = selectedDate ? new Date(selectedDate) : new Date();
      const end = selectedDate ? new Date(selectedDate) : new Date();
      
      if (startTime) {
        const [hours, minutes] = startTime.split(":").map(Number);
        start.setHours(hours, minutes, 0, 0);
      } else {
        start.setHours(9, 0, 0, 0);
      }
      
      if (endTime) {
        const [hours, minutes] = endTime.split(":").map(Number);
        end.setHours(hours, minutes, 0, 0);
      } else {
        end.setTime(start.getTime() + (60 * 60 * 1000)); // Add 1 hour
      }
      
      setStartDate(start.toISOString().slice(0, 16));
      setEndDate(end.toISOString().slice(0, 16));
    }
    
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title) {
      toast({
        title: t("common.error"),
        description: t("events.fullNameRequired"),
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      
      let filePath = null;
      let fileName = null;
      
      // Upload file if selected
      if (selectedFile) {
        const timestamp = new Date().getTime();
        const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9-_.]/g, "_");
        const path = `booking_files/${timestamp}_${safeFileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("booking_attachments")
          .upload(path, selectedFile, {
            contentType: selectedFile.type,
            cacheControl: "3600"
          });
          
        if (uploadError) {
          throw new Error(`Error uploading file: ${uploadError.message}`);
        }
        
        filePath = path;
        fileName = selectedFile.name;
        
        // Create file record
        const { error: fileRecordError } = await supabase
          .from("booking_files")
          .insert({
            booking_id: null,
            filename: selectedFile.name,
            file_path: path,
            content_type: selectedFile.type,
            size: selectedFile.size
          });
          
        if (fileRecordError) {
          console.error("Error creating file record:", fileRecordError);
        }
      }
      
      const bookingData = {
        business_id: businessId,
        requester_name: title,
        requester_email: socialNetworkLink,
        requester_phone: userNumber,
        title: title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        description: eventNotes,
        event_notes: eventNotes,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        status: "pending",
        payment_status: paymentStatus || "not_paid",
        payment_amount: paymentStatus !== 'not_paid' ? Number(paymentAmount) || null : null,
        file_path: filePath,
        filename: fileName
      };
      
      const response = await createBookingRequest(bookingData);
      
      if (selectedFile && filePath) {
        const { error: updateFileError } = await supabase
          .from("booking_files")
          .update({ booking_id: response.id })
          .eq("file_path", filePath);
          
        if (updateFileError) {
          console.error("Error updating file record with booking ID:", updateFileError);
        }
      }
      
      toast({
        title: t("bookings.requestSubmitted"),
        description: t("bookings.requestSubmittedDesc"),
      });
      
      handleOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("bookings.errorSubmitting"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogTitle>{t("bookings.requestBooking")}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            dialogOpen={open}
          />
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading || !!fileError}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.submitting")}
                </>
              ) : (
                t("common.submit")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
