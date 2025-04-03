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
import { Loader2 } from "lucide-react";

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
      
      await createBookingRequest({
        ...values,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        payment_amount: paymentAmount
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
        <DialogTitle>{t("booking.requestTitle")}</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("booking.bookingTitle")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("booking.bookingTitlePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requester_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("booking.yourName")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("booking.yourNamePlaceholder")} {...field} />
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
                <FormLabel>{t("booking.yourEmail")}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder={t("booking.yourEmailPlaceholder")} {...field} />
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
                <FormLabel>{t("booking.yourPhone")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("booking.yourPhonePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("booking.startTime")}</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
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
                  <FormLabel>{t("booking.endTime")}</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="payment_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("booking.paymentAmount")}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" {...field} />
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
                <FormLabel>{t("booking.description")}</FormLabel>
                <FormControl>
                  <Textarea placeholder={t("booking.descriptionPlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
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
                  {t("booking.submitting")}
                </>
              ) : (
                t("booking.submit")
              )}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};
