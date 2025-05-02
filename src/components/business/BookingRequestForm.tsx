import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBookingRequest, checkRateLimitStatus } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// Define the form schema with Zod
const formSchema = z.object({
  requester_name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  requester_email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  requester_phone: z.string().optional(),
  description: z.string().optional(),
  start_date: z.date({
    required_error: "Please select a start date and time.",
  }),
  end_date: z.date({
    required_error: "Please select an end date and time.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface BookingRequestFormProps {
  businessId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  disabledTimes?: {
    startTime: string;
    endTime: string;
  }[];
}

export const BookingRequestForm = ({
  businessId,
  onSuccess,
  onError,
  minDate,
  maxDate,
  disabledDates = [],
  disabledTimes = [],
}: BookingRequestFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const { t, language } = useLanguage();

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requester_name: "",
      requester_email: "",
      requester_phone: "",
      description: "",
    },
  });

  // Check rate limit status on component mount
  useEffect(() => {
    const checkRateLimit = async () => {
      const { isLimited, remainingTime } = await checkRateLimitStatus();
      setRateLimited(isLimited);
      setRemainingTime(remainingTime);
    };

    checkRateLimit();

    // Set up countdown timer if rate limited
    let timer: number | undefined;
    if (rateLimited && remainingTime > 0) {
      timer = window.setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [rateLimited]);

  // Format remaining time for display
  const formatRemainingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    if (rateLimited) {
      toast({
        title: "Rate limit reached",
        description: `Please wait ${formatRemainingTime(
          remainingTime
        )} before submitting another request.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Format dates as ISO strings
      const bookingData = {
        business_id: businessId,
        requester_name: data.requester_name,
        requester_email: data.requester_email,
        requester_phone: data.requester_phone || null,
        description: data.description || null,
        start_date: data.start_date.toISOString(),
        end_date: data.end_date.toISOString(),
        title: `Booking for ${data.requester_name}`,
        language: language, // Pass the current language
      };

      console.log("Submitting booking request:", bookingData);
      await createBookingRequest(bookingData);

      toast({
        title: t("common.success"),
        description: "Your booking request has been submitted successfully.",
      });

      // Reset form
      form.reset({
        requester_name: "",
        requester_email: "",
        requester_phone: "",
        description: "",
      });

      // Call success callback if provided
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error submitting booking request:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit booking request",
        variant: "destructive",
      });

      // Call error callback if provided
      if (onError && error instanceof Error) onError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="requester_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.name")}</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
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
              <FormLabel>{t("common.email")}</FormLabel>
              <FormControl>
                <Input placeholder="john@example.com" {...field} />
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
              <FormLabel>{t("common.phone")} ({t("common.optional")})</FormLabel>
              <FormControl>
                <Input placeholder="+1 234 567 8900" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t("common.startDate")}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP HH:mm")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        // Disable dates before today
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        // Apply minDate if provided
                        if (minDate) {
                          const min = new Date(minDate);
                          min.setHours(0, 0, 0, 0);
                          if (date < min) return true;
                        }
                        
                        // Apply maxDate if provided
                        if (maxDate) {
                          const max = new Date(maxDate);
                          max.setHours(0, 0, 0, 0);
                          if (date > max) return true;
                        }
                        
                        // Check if date is in disabledDates
                        return date < today || disabledDates.some(
                          (disabledDate) => 
                            disabledDate.getDate() === date.getDate() &&
                            disabledDate.getMonth() === date.getMonth() &&
                            disabledDate.getFullYear() === date.getFullYear()
                        );
                      }}
                      initialFocus
                    />
                    <div className="p-3 border-t border-border">
                      <Input
                        type="time"
                        value={field.value ? format(field.value, "HH:mm") : ""}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(":");
                          const newDate = field.value
                            ? new Date(field.value)
                            : new Date();
                          newDate.setHours(parseInt(hours, 10));
                          newDate.setMinutes(parseInt(minutes, 10));
                          field.onChange(newDate);
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t("common.endDate")}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP HH:mm")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        // Disable dates before start date
                        const startDate = form.getValues("start_date");
                        if (startDate) {
                          const start = new Date(startDate);
                          start.setHours(0, 0, 0, 0);
                          if (date < start) return true;
                        }
                        
                        // Apply maxDate if provided
                        if (maxDate) {
                          const max = new Date(maxDate);
                          max.setHours(0, 0, 0, 0);
                          if (date > max) return true;
                        }
                        
                        // Check if date is in disabledDates
                        return disabledDates.some(
                          (disabledDate) => 
                            disabledDate.getDate() === date.getDate() &&
                            disabledDate.getMonth() === date.getMonth() &&
                            disabledDate.getFullYear() === date.getFullYear()
                        );
                      }}
                      initialFocus
                    />
                    <div className="p-3 border-t border-border">
                      <Input
                        type="time"
                        value={field.value ? format(field.value, "HH:mm") : ""}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(":");
                          const newDate = field.value
                            ? new Date(field.value)
                            : new Date();
                          newDate.setHours(parseInt(hours, 10));
                          newDate.setMinutes(parseInt(minutes, 10));
                          field.onChange(newDate);
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
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
              <FormLabel>{t("common.notes")} ({t("common.optional")})</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any special requests or additional information"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting || rateLimited}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("common.loading")}
            </>
          ) : rateLimited ? (
            `Please wait ${formatRemainingTime(remainingTime)}`
          ) : (
            "Submit Booking Request"
          )}
        </Button>
      </form>
    </Form>
  );
};
