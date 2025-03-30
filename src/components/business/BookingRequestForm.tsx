
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format, addHours } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { LoaderCircle, CheckCircle } from "lucide-react";

const bookingSchema = z.object({
  requester_name: z.string().min(2, { message: "Please enter your name" }),
  requester_email: z.string().email({ message: "Please enter a valid email address" }),
  requester_phone: z.string().optional(),
  title: z.string().min(2, { message: "Please enter a booking title" }),
  description: z.string().optional(),
  date: z.string(),
  time: z.string(),
  duration: z.string(),
});

interface BookingRequestFormProps {
  businessId: string;
  selectedDate?: Date;
  onSuccess?: () => void;
}

export const BookingRequestForm = ({ 
  businessId, 
  selectedDate = new Date(),
  onSuccess 
}: BookingRequestFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Generate time slots for the day
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute of [0, 30]) {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        options.push({
          value: format(time, "HH:mm"),
          label: format(time, "h:mm a"),
        });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();
  
  const durationOptions = [
    { value: "30", label: "30 minutes" },
    { value: "60", label: "1 hour" },
    { value: "90", label: "1.5 hours" },
    { value: "120", label: "2 hours" },
  ];

  const form = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      requester_name: "",
      requester_email: "",
      requester_phone: "",
      title: "",
      description: "",
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      time: "09:00",
      duration: "60",
    },
  });

  const onSubmit = async (values: z.infer<typeof bookingSchema>) => {
    setIsSubmitting(true);
    
    try {
      const startDate = new Date(`${values.date}T${values.time}`);
      const endDate = addHours(startDate, parseInt(values.duration) / 60);
      
      const { error } = await supabase
        .from("booking_requests")
        .insert([
          {
            business_id: businessId,
            requester_name: values.requester_name,
            requester_email: values.requester_email,
            requester_phone: values.requester_phone || null,
            title: values.title,
            description: values.description || null,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            status: "pending",
          },
        ]);

      if (error) throw error;
      
      setIsSubmitted(true);
      toast({
        title: "Booking request submitted",
        description: "We'll notify you when the business responds to your request.",
      });
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 3000);
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit booking request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">Booking Request Submitted</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          Thank you for your booking request. The business will review your request and get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Book an Appointment</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="requester_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name *</FormLabel>
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
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="johndoe@example.com" type="email" {...field} />
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
                    <Input placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormDescription>Optional but recommended</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Appointment Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Initial Consultation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {durationOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please provide any additional information about your appointment request"
                      className="resize-y h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Submit Booking Request
          </Button>
        </form>
      </Form>
    </div>
  );
};
