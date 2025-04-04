
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { DialogHeader, DialogTitle } from "../ui/dialog";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { createBookingRequest } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { EventDialogFields } from "../Calendar/EventDialogFields";

interface BookingRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  businessId: string;
  selectedDate: Date;
  startTime?: string;
  endTime?: string;
}

const BookingSchema = z.object({
  title: z.string().min(2, "Title is required"),
  requester_name: z.string().min(2, "Name is required"),
  requester_email: z.string().email("Valid email is required"),
  requester_phone: z.string().optional(),
  description: z.string().optional(),
  start_date: z.string(),
  end_date: z.string(),
  payment_amount: z.union([
    z.string().optional(), 
    z.number().optional(),
    z.null()
  ]),
  payment_status: z.string().optional(),
  business_id: z.string(),
});

type FormValues = z.infer<typeof BookingSchema>;

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
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Event dialog fields state
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

  const form = useForm<FormValues>({
    resolver: zodResolver(BookingSchema),
    defaultValues: {
      title: "",
      requester_name: "",
      requester_email: "",
      requester_phone: "",
      description: "",
      start_date: `${formattedDate}T${defaultStartTime}:00`,
      end_date: `${formattedDate}T${defaultEndTime}:00`,
      payment_amount: "",
      payment_status: "not_paid",
      business_id: businessId,
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      
      let paymentAmountValue: number | null = null;
      
      if (paymentAmount && paymentAmount !== '') {
        const parsedAmount = Number(paymentAmount);
        paymentAmountValue = isNaN(parsedAmount) ? null : parsedAmount;
      }
      
      await createBookingRequest({
        title: title,
        requester_name: userSurname,
        requester_email: socialNetworkLink,
        requester_phone: userNumber || "",
        description: eventNotes || "",
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        payment_amount: paymentAmountValue,
        business_id: businessId,
        payment_status: paymentStatus,
      });
      
      toast({
        title: t("common.success"),
        description: t("booking.requestSubmitted"),
      });
      
      onOpenChange(false);
      onSuccess?.();
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
    <>
      <DialogHeader>
        <DialogTitle>Request Booking</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4 mt-4">
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
          isBookingRequest={false}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.submitting")}
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
