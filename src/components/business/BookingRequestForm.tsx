import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { LanguageText } from "@/components/shared/LanguageText";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCurrencySymbol } from "@/lib/currency";

// Schema updated to include payment fields
const bookingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().optional(),
  date: z.date({
    required_error: "Please select a date.",
  }),
  time: z.string().min(1, "Please select a time."),
  duration: z.string().min(1, "Please select a duration."),
  notes: z.string().optional(),
  paymentStatus: z.string().optional(),
  paymentAmount: z.string().optional(),
});

export function BookingRequestForm({ businessId }: { businessId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");
  const { language, t } = useLanguage();
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("not_paid");
  const currencySymbol = getCurrencySymbol(language);

  const form = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      date: dateParam ? new Date(dateParam) : new Date(),
      time: timeParam || "09:00",
      duration: "30",
      notes: "",
      paymentStatus: "not_paid",
      paymentAmount: "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof bookingSchema>) => {
    setIsSubmitting(true);

    try {
      const { name, email, phone, date, time, duration, notes, paymentStatus, paymentAmount } = values;

      const startDateTime = new Date(date);
      const [hours, minutes] = time.split(":").map(Number);
      startDateTime.setHours(hours, minutes, 0, 0);

      const durationInMinutes = parseInt(duration, 10);
      const endDateTime = new Date(startDateTime.getTime() + durationInMinutes * 60000);

      const { data, error } = await supabase
        .from("booking_requests")
        .insert([
          {
            business_id: businessId,
            requester_name: name,
            requester_email: email,
            requester_phone: phone,
            title: `Booking Request by ${name}`,
            start_date: startDateTime.toISOString(),
            end_date: endDateTime.toISOString(),
            description: notes,
            status: "pending",
            payment_status: paymentStatus,
            payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
          },
        ]);

      if (error) {
        console.error("Error submitting booking request:", error);
        toast.error(t("common.requestFailed"));
      } else {
        toast.success(t("common.requestSubmitted"));
        form.reset();
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error(t("common.requestFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    return date ? format(date, "PPP") : "";
  };
  
  // Render the payment amount field only when payment status is partly or fully paid
  const showPaymentAmount = selectedPaymentStatus === "partly_paid" || selectedPaymentStatus === "fully_paid";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("common.name")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder={t("common.yourName")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("common.email")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder="email@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("common.phone")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder={t("common.phoneNumber")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>
                <LanguageText>{t("common.date")}</LanguageText>
              </FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {formatDate(field.value)}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>
                  <LanguageText>{t("common.time")}</LanguageText>
                </FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>
                  <LanguageText>{t("common.duration")}</LanguageText>
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.selectDuration")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="30">30 {t("common.minutes")}</SelectItem>
                    <SelectItem value="60">1 {t("common.hour")}</SelectItem>
                    <SelectItem value="90">1.5 {t("common.hours")}</SelectItem>
                    <SelectItem value="120">2 {t("common.hours")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="paymentStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("events.paymentStatus")}</LanguageText>
              </FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedPaymentStatus(value);
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("events.selectPaymentStatus")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="not_paid">
                    <LanguageText>{t("crm.notPaid")}</LanguageText>
                  </SelectItem>
                  <SelectItem value="partly_paid">
                    <LanguageText>{t("crm.paidPartly")}</LanguageText>
                  </SelectItem>
                  <SelectItem value="fully_paid">
                    <LanguageText>{t("crm.paidFully")}</LanguageText>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {showPaymentAmount && (
          <FormField
            control={form.control}
            name="paymentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LanguageText>{t("events.paymentAmount")}</LanguageText>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-gray-500">{currencySymbol}</span>
                    </div>
                    <Input
                      placeholder="0.00"
                      type="text"
                      inputMode="decimal"
                      className="pl-7"
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                          field.onChange(value);
                        }
                      }}
                      value={field.value}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("events.eventNotes")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("events.addEventNotes")}
                  className="resize-none min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <LanguageText>{t("common.submitting")}</LanguageText>
          ) : (
            <LanguageText>{t("common.submitRequest")}</LanguageText>
          )}
        </Button>
      </form>
    </Form>
  );
}
