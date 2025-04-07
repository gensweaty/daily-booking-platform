
import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { DialogHeader, DialogTitle } from "../ui/dialog";
import { Loader2 } from "lucide-react";
import { EventDialogFields } from "../Calendar/EventDialogFields";
import { createBookingRequest } from "@/lib/api";

interface BookingRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  businessId: string;
  selectedDate: Date;
  startTime?: string;
  endTime?: string;
}

export const BookingRequestForm = ({
  open,
  onOpenChange,
  onSuccess,
  businessId,
  selectedDate,
  startTime,
  endTime,
}: BookingRequestFormProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Event dialog fields state
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

  const formattedDate = selectedDate ? 
    new Date(selectedDate).toISOString().split('T')[0] : 
    new Date().toISOString().split('T')[0];
  
  const defaultStartTime = startTime || "09:00";
  const defaultEndTime = endTime || "10:00";

  useEffect(() => {
    if (selectedDate) {
      const start = new Date(selectedDate);
      start.setHours(parseInt(defaultStartTime.split(':')[0]), parseInt(defaultStartTime.split(':')[1]), 0, 0);
      
      const end = new Date(selectedDate);
      end.setHours(parseInt(defaultEndTime.split(':')[0]), parseInt(defaultEndTime.split(':')[1]), 0, 0);
      
      setStartDate(start.toISOString().slice(0, 16));
      setEndDate(end.toISOString().slice(0, 16));
    }
  }, [selectedDate, defaultStartTime, defaultEndTime]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      
      let paymentAmountValue: number | null = null;
      
      if (paymentAmount && paymentAmount !== '' && paymentStatus !== 'not_paid') {
        const parsedAmount = Number(paymentAmount);
        paymentAmountValue = isNaN(parsedAmount) ? null : parsedAmount;
      }
      
      // Print debug information to help diagnose the issue
      console.log("Submitting booking request with data:", {
        title: userSurname, // Use customer name as the title
        requester_name: userSurname,
        requester_email: socialNetworkLink,
        requester_phone: userNumber,
        description: eventNotes,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        payment_amount: paymentAmountValue,
        payment_status: paymentStatus,
        business_id: businessId,
        selectedFile: selectedFile ? `${selectedFile.name} (${selectedFile.size} bytes)` : 'none'
      });
      
      // Pass both the booking request data and the file
      await createBookingRequest({
        title: userSurname, // Use customer name as the title
        requester_name: userSurname,
        requester_email: socialNetworkLink,
        requester_phone: userNumber || "",
        description: eventNotes || "",
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        payment_amount: paymentAmountValue,
        payment_status: paymentStatus,
        business_id: businessId,
      }, selectedFile); // Pass the selected file
      
      toast({
        title: "Success",
        description: "Booking request submitted successfully",
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit booking request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Request Booking</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4 mt-4">
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
          isBookingRequest={true}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </div>
      </form>
    </>
  );
};
