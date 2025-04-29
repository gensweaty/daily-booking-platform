
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addHours, parse } from "date-fns";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/components/ui/use-toast";
import { createBookingRequest } from "@/lib/api";
import { useEffect } from "react";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";

const formSchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters" }),
  requester_name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  requester_email: z.string().email({ message: "Invalid email address" }),
  requester_phone: z.string().min(5, { message: "Phone must be at least 5 characters" }),
  description: z.string().optional(),
  date: z.date(),
  time: z.string(),
  duration: z.coerce.number().min(15, { message: "Duration must be at least 15 minutes" }).max(480, { message: "Duration cannot exceed 8 hours" }),
});

type FormValues = z.infer<typeof formSchema>;

interface BookingRequestFormProps {
  businessId: string;
  selectedDate?: Date | null;
  selectedTime?: string | null;
  onSuccess: () => void;
}

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  selectedTime,
  onSuccess
}: BookingRequestFormProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const isGeorgian = language === 'ka';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      requester_name: "",
      requester_email: "",
      requester_phone: "",
      description: "",
      date: selectedDate || new Date(),
      time: selectedTime || format(new Date(), "HH:mm"),
      duration: 60,
    },
  });

  useEffect(() => {
    if (selectedDate) {
      form.setValue("date", selectedDate);
    }
    
    if (selectedTime) {
      form.setValue("time", selectedTime);
    }
  }, [selectedDate, selectedTime, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      
      // Parse the selected date and time
      const selectedDate = values.date;
      const [hours, minutes] = values.time.split(":").map(Number);
      
      // Create starting date/time
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(hours, minutes, 0, 0);
      
      // Calculate ending date/time based on duration (in minutes)
      const endDateTime = addHours(startDateTime, values.duration / 60);
      
      console.log("Booking request submission:", {
        values,
        startDateTime,
        endDateTime,
        file: selectedFile ? selectedFile.name : 'No file'
      });
      
      await createBookingRequest({
        business_id: businessId,
        title: values.title,
        requester_name: values.requester_name,
        requester_email: values.requester_email,
        requester_phone: values.requester_phone,
        description: values.description || "",
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
      }, selectedFile);
      
      toast({
        title: t("business.bookingRequestSuccess"),
        description: t("business.bookingRequestSuccessDescription"),
      });
      
      form.reset();
      setSelectedFile(null);
      onSuccess();
    } catch (error) {
      console.error("Error creating booking request:", error);
      toast({
        title: t("common.error"),
        description: t("business.bookingRequestError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-md bg-background">
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn("font-medium", isGeorgian && "font-georgian")}>
                    {t("calendar.eventTitle")}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requester_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={cn("font-medium", isGeorgian && "font-georgian")}>
                      {t("calendar.name")}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel className={cn("font-medium", isGeorgian && "font-georgian")}>
                      {t("calendar.phone")}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="requester_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn("font-medium", isGeorgian && "font-georgian")}>
                    {t("calendar.email")}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className={cn("font-medium", isGeorgian && "font-georgian")}>
                      {t("calendar.date")}
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t("calendar.pickDate")}</span>
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
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={cn("font-medium", isGeorgian && "font-georgian")}>
                      {t("calendar.time")}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={cn("font-medium", isGeorgian && "font-georgian")}>
                      {t("calendar.durationMinutes")}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={15} max={480} step={15} />
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
                  <FormLabel className={cn("font-medium", isGeorgian && "font-georgian")}>
                    {t("calendar.description")}
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FileUploadField
                onChange={setSelectedFile}
                fileError={fileError}
                setFileError={setFileError}
                acceptedFileTypes="image/*, application/pdf, application/vnd.openxmlformats-officedocument.*"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? t("common.submitting") : t("business.submitRequest")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
