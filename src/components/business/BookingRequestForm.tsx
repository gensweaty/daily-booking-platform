
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { format, addHours } from "date-fns";
import { useToast } from "../ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { DialogHeader, DialogTitle } from "../ui/dialog";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { createBookingRequest } from "@/lib/api";
import { Loader2, AlertCircle } from "lucide-react";
import { FileUploadField } from "../shared/FileUploadField";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { canMakeBookingRequest } from "@/utils/rateLimit";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

interface BookingRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  businessId: string;
  selectedDate: Date;
  startTime?: string;
  endTime?: string;
  isExternalBooking?: boolean;
}

const BookingSchema = z.object({
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
  event_type: z.string().optional(),
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
  isExternalBooking = false,
}: BookingRequestFormProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [rateLimitError, setRateLimitError] = useState<{ isLimited: boolean; timeRemaining: number }>({
    isLimited: false,
    timeRemaining: 0
  });
  
  // Get user's IP address or use a fallback for local testing
  const [userIP, setUserIP] = useState<string>("unknown");
  
  // Fetch user's IP address when component mounts
  useState(() => {
    const getUserIP = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        if (data?.ip) {
          setUserIP(data.ip);
          
          // Check if this IP is rate limited
          const { isAllowed, timeRemaining } = canMakeBookingRequest(data.ip);
          if (!isAllowed) {
            setRateLimitError({
              isLimited: true,
              timeRemaining
            });
          }
        }
      } catch (error) {
        console.error("Failed to get user IP:", error);
        // Use a fallback mechanism - browser fingerprint or timestamp
        setUserIP(`fallback_${Date.now()}`);
      }
    };
    
    if (isExternalBooking) {
      getUserIP();
    }
  });

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  
  const defaultStartTime = startTime || format(selectedDate, "HH:mm");
  const defaultEndTime = endTime || format(addHours(selectedDate, 1), "HH:mm");

  const form = useForm<FormValues>({
    resolver: zodResolver(BookingSchema),
    defaultValues: {
      requester_name: "",
      requester_email: "",
      requester_phone: "",
      description: "",
      start_date: `${formattedDate}T${defaultStartTime}:00`,
      end_date: `${formattedDate}T${defaultEndTime}:00`,
      payment_amount: "",
      payment_status: "not_paid",
      event_type: "booking_request",
      business_id: businessId,
    },
  });

  const paymentStatus = form.watch("payment_status");

  const onSubmit = async (values: FormValues) => {
    try {
      // Check rate limiting for external bookings
      if (isExternalBooking) {
        const { isAllowed, timeRemaining } = canMakeBookingRequest(userIP);
        
        if (!isAllowed) {
          setRateLimitError({
            isLimited: true,
            timeRemaining
          });
          
          toast({
            title: t("common.error"),
            description: t("booking.rateLimitExceeded", { minutes: Math.ceil(timeRemaining / 60) }),
            variant: "destructive"
          });
          
          return;
        }
      }
      
      setIsSubmitting(true);
      console.log("Submitting booking request:", values);

      const start = new Date(values.start_date);
      const end = new Date(values.end_date);
      
      let paymentAmount: number | null = null;
      
      if (values.payment_amount !== undefined && values.payment_amount !== null && values.payment_amount !== '') {
        const parsedAmount = Number(values.payment_amount);
        paymentAmount = isNaN(parsedAmount) ? null : parsedAmount;
      }
      
      const result = await createBookingRequest({
        title: values.requester_name, // Use requester name as the title
        requester_name: values.requester_name,
        requester_email: values.requester_email,
        requester_phone: values.requester_phone || "",
        description: values.description || "",
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        payment_amount: paymentAmount,
        payment_status: values.payment_status || "not_paid",
        business_id: businessId,
      });
      
      // Handle file upload if a file is selected
      if (selectedFile && result?.id) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        console.log('Uploading file for booking request:', filePath);
        
        const { error: uploadError } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);
          
        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          throw uploadError;
        }
        
        // Associate file with the booking request
        const { error: fileRecordError } = await supabase
          .from('event_files')
          .insert({
            event_id: result.id,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size
          });
          
        if (fileRecordError) {
          console.error('Error creating file record:', fileRecordError);
          throw fileRecordError;
        }
        
        console.log('File uploaded and associated with booking request');
      }
      
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
        <DialogTitle>{t("events.submitBookingRequest")}</DialogTitle>
      </DialogHeader>
      
      {rateLimitError.isLimited && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>
            {t("booking.rateLimitMessage", { 
              seconds: rateLimitError.timeRemaining,
              minutes: Math.ceil(rateLimitError.timeRemaining / 60) 
            })}
          </AlertDescription>
        </Alert>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <FormField
            control={form.control}
            name="requester_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("events.fullNameRequired")}</FormLabel>
                <FormControl>
                  <Input 
                    placeholder={t("events.fullName") || "Enter your full name"} 
                    {...field} 
                    className="bg-background border border-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requester_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("contact.email")}</FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    placeholder={t("booking.yourEmailPlaceholder") || "Enter your email"} 
                    {...field} 
                    className="bg-background border border-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requester_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("events.phoneNumber")}</FormLabel>
                <FormControl>
                  <Input 
                    placeholder={t("events.phoneNumber") || "Enter your phone number"} 
                    {...field} 
                    className="bg-background border border-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("events.paymentStatus")}</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="bg-background border border-input">
                      <SelectValue placeholder={t("events.selectPaymentStatus") || "Select payment status"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-background">
                    <SelectItem value="not_paid">{t("crm.notPaid") || "Not Paid"}</SelectItem>
                    <SelectItem value="partly">{t("crm.paidPartly") || "Partly Paid"}</SelectItem>
                    <SelectItem value="fully">{t("crm.paidFully") || "Fully Paid"}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {(paymentStatus === "partly" || paymentStatus === "fully") && (
            <FormField
              control={form.control}
              name="payment_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.paymentAmount")}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      {...field} 
                      className="bg-background border border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.startDateTime")}</FormLabel>
                  <FormControl>
                    <Input 
                      type="datetime-local" 
                      {...field} 
                      className="bg-background border border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.endDateTime")}</FormLabel>
                  <FormControl>
                    <Input 
                      type="datetime-local" 
                      {...field} 
                      className="bg-background border border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("events.eventNotes")}</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder={t("events.addEventNotes") || "Enter notes"} 
                    {...field} 
                    className="bg-background border border-input min-h-[80px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Label>{t("calendar.attachment")}</Label>
            <FileUploadField
              onChange={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              hideDescription={true}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || rateLimitError.isLimited}
              className="bg-background"
            >
              {t("common.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || rateLimitError.isLimited}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.submitting")}
                </>
              ) : (
                t("events.submitBookingRequest")
              )}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};
