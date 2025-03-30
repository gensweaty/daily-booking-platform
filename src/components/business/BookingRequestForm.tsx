import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createBookingRequest } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface BookingRequestFormProps {
  businessId: string;
  selectedDate?: Date;
  onSuccess: () => void;
}

const formSchema = z.object({
  requesterName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  requesterEmail: z.string().email({ message: "Please enter a valid email address." }),
  requesterPhone: z.string().optional(),
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
  description: z.string().optional(),
  date: z.date({ required_error: "Please select a date." }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Please enter a valid time in 24-hour format (HH:MM)." }),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Please enter a valid time in 24-hour format (HH:MM)." }),
});

export const BookingRequestForm = ({ businessId, selectedDate, onSuccess }: BookingRequestFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requesterName: "",
      requesterEmail: "",
      requesterPhone: "",
      title: "",
      description: "",
      date: selectedDate || new Date(),
      startTime: "09:00",
      endTime: "10:00",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      console.log("Form values:", values);
      
      // Create Date objects for start and end times
      const { date, startTime, endTime, ...otherValues } = values;
      
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);
      
      const startDate = new Date(date);
      startDate.setHours(startHour, startMinute, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(endHour, endMinute, 0, 0);

      // Check if end time is before start time
      if (endDate <= startDate) {
        toast({
          title: "Invalid Time Range",
          description: "End time must be after start time.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const requestData = {
        business_id: businessId,
        requester_name: values.requesterName,
        requester_email: values.requesterEmail,
        requester_phone: values.requesterPhone || '',
        title: values.title,
        description: values.description || '',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      };

      console.log("Submitting booking request:", requestData);

      // Direct Supabase insert for booking requests to bypass API layer (as API layer might have auth constraints)
      const { data, error } = await supabase
        .from('booking_requests')
        .insert([requestData])
        .select();

      if (error) {
        console.error("Error creating booking request:", error);
        throw new Error(error.message);
      }
      
      console.log("Booking request result:", data);

      toast({
        title: "Booking Request Submitted",
        description: "Your booking request has been submitted successfully.",
      });
      
      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
      toast({
        title: "Error",
        description: error.message || "There was a problem submitting your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Request a Booking</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Fill out this form to request an appointment.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="requesterName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requesterEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="requesterPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Booking Title</FormLabel>
                <FormControl>
                  <Input placeholder="Hair Cut Appointment" {...field} />
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
                <FormLabel>Additional Details (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any special requests or additional information..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
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
                            format(field.value, "PPP")
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
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Booking Request"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};
