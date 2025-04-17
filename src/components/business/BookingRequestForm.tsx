import { useState, useEffect } from "react";
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
import { createBookingRequest, checkRateLimitStatus } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { FileUploadField } from "../shared/FileUploadField";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

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
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTimeRemaining, setRateLimitTimeRemaining] = useState(0);

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

  useEffect(() => {
    if (open) {
      const checkRateLimit = async () => {
        try {
          const { isLimited, remainingTime } = await checkRateLimitStatus();
          setIsRateLimited(isLimited);
          setRateLimitTimeRemaining(remainingTime);
          
          if (isLimited) {
            const minutes = Math.floor(remainingTime / 60);
            const seconds = remainingTime % 60;
            const timeDisplay = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
            
            toast({
              title: t("common.rateLimitReached"),
              description: t("common.waitBeforeBooking", { time: timeDisplay }),
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error checking rate limit:", error);
        }
      };
      
      checkRateLimit();
    }
  }, [open, toast, t]);

  useEffect(() => {
    if (!isRateLimited || rateLimitTimeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setRateLimitTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRateLimited(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isRateLimited, rateLimitTimeRemaining]);

  const onSubmit = async (values: FormValues) => {
    try {
      const { isLimited, remainingTime } = await checkRateLimitStatus();
      
      if (isLimited) {
        setIsRateLimited(true);
        setRateLimitTimeRemaining(remainingTime);
        
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        const timeDisplay = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
        
        toast({
          title: t("common.rateLimitReached"),
          description: t("common.waitBeforeBooking", { time: timeDisplay }),
          variant: "destructive",
        });
        return;
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
        title: values.requester_name,
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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {isRateLimited && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-md mb-4">
              <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                {t("common.rateLimitMessage")}
              </p>
              <p className="text-amber-600 dark:text-amber-500 text-sm mt-1">
                {t("common.waitTimeRemaining")}: {Math.floor(rateLimitTimeRemaining / 60)}:
                {(rateLimitTimeRemaining % 60).toString().padStart(2, '0')}
              </p>
            </div>
          )}
          
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
              disabled={isSubmitting}
              className="bg-background"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || isRateLimited}>
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
