
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { format, addHours } from "date-fns";
import { useToast } from "../ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { DialogHeader, DialogTitle } from "../ui/dialog";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { createBookingRequest } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { FileUploadField } from "../shared/FileUploadField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { supabase } from "@/lib/supabase";

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
  title: z.string().min(2, "Full name is required"),
  requester_name: z.string().optional(),
  requester_email: z.string().email("Valid email is required"),
  requester_phone: z.string().optional(),
  description: z.string().optional(),
  start_date: z.string(),
  end_date: z.string(),
  payment_status: z.string().optional(),
  payment_amount: z.union([
    z.string().optional(), 
    z.number().optional(),
    z.null()
  ]),
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
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  
  const defaultStartTime = startTime || format(selectedDate, "HH:mm");
  const defaultEndTime = endTime || format(addHours(selectedDate, 1), "HH:mm");

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
      payment_status: "not_paid",
      payment_amount: "",
      business_id: businessId,
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      console.log("Submitting booking request:", values);

      const start = new Date(values.start_date);
      const end = new Date(values.end_date);
      
      let paymentAmount: number | null = null;
      
      if (values.payment_amount !== undefined && values.payment_amount !== null && values.payment_amount !== '') {
        const parsedAmount = Number(values.payment_amount);
        paymentAmount = isNaN(parsedAmount) ? null : parsedAmount;
      }
      
      const booking = await createBookingRequest({
        title: values.title,
        requester_name: values.requester_name || "",
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
      if (selectedFile && booking?.id) {
        try {
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

          // Create booking_files record
          const { error: fileRecordError } = await supabase
            .from('booking_files')
            .insert({
              booking_id: booking.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size,
            });

          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
            throw fileRecordError;
          }

          console.log('File uploaded successfully for booking request');
        } catch (fileError: any) {
          console.error('Error handling file upload:', fileError);
          // Continue with submission even if file upload fails
        }
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
        <DialogTitle>Add New Event</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name (required)</FormLabel>
                <FormControl>
                  <Input placeholder="Full Name" {...field} />
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
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="Phone Number" {...field} />
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
                <FormLabel>Social Link or Email</FormLabel>
                <FormControl>
                  <Input placeholder="Social Link or Email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <FormLabel>Date and Time</FormLabel>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel className="text-sm text-muted-foreground mb-1">
                  Start Date & Time
                </FormLabel>
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormLabel className="text-sm text-muted-foreground mb-1">
                  End Date & Time
                </FormLabel>
                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <FormField
            control={form.control}
            name="payment_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="not_paid">Not Paid</SelectItem>
                    <SelectItem value="partly">Partly Paid</SelectItem>
                    <SelectItem value="fully">Fully Paid</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Add event notes..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <FileUploadField
              onChange={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-purple-500 hover:bg-purple-600" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("booking.submitting")}
                </>
              ) : (
                "Create Event"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};
