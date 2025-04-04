
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventDialogFields } from "./EventDialogFields";
import { nanoid } from "nanoid";

interface BookingRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  businessId: string;
  onSuccess?: () => void;
}

export const BookingRequestDialog = ({
  open,
  onOpenChange,
  selectedDate,
  businessId,
  onSuccess
}: BookingRequestDialogProps) => {
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { t } = useLanguage();

  // Reset form when dialog opens or closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const resetForm = () => {
    setTitle("");
    setUserSurname("");
    setUserNumber("");
    setSocialNetworkLink("");
    setEventNotes("");
    setStartDate("");
    setEndDate("");
    setPaymentStatus("");
    setPaymentAmount("");
    setSelectedFile(null);
    setFileError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!businessId) {
        throw new Error("Business ID is required");
      }

      if (!title) {
        throw new Error("Full name is required");
      }

      if (!startDate || !endDate) {
        throw new Error("Start and end dates are required");
      }

      // Create the booking request
      const { data: bookingData, error: bookingError } = await supabase
        .from("booking_requests")
        .insert({
          business_id: businessId,
          title,
          requester_name: userSurname || title,
          requester_phone: userNumber,
          requester_email: socialNetworkLink,
          description: eventNotes,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          status: "pending"
        })
        .select()
        .single();

      if (bookingError) {
        console.error("Error creating booking request:", bookingError);
        throw new Error("Failed to create booking request");
      }

      // If there's a file, upload it
      if (selectedFile && bookingData?.id) {
        // Upload file to storage
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${nanoid()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          throw new Error("Failed to upload file");
        }

        // Create file record in database
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
          console.error("Error creating file record:", fileRecordError);
        }
      }

      toast({
        title: t("common.success"),
        description: t("business.bookingRequestSuccess"),
      });

      resetForm();
      handleOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle>{t("business.requestBooking")}</DialogTitle>
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
          />
          
          <div className="flex justify-end gap-4 mt-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? t("common.submitting") : t("business.submitRequest")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
