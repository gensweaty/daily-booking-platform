
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { BookingRequest } from "@/types/database";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { LoaderCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DialogClose } from "@/components/ui/dialog";

interface BookingRequestFormProps {
  businessId: string;
  eventTitle?: string;
  eventDateTime?: string;
  onClose?: () => void;
  // For Calendar integration
  selectedDate?: Date;
  startTime?: string;
  endTime?: string;
  onSuccess?: () => void;
  isExternalBooking?: boolean;
}

export const BookingRequestForm = ({ 
  businessId, 
  eventTitle, 
  eventDateTime,
  onClose,
  selectedDate,
  startTime,
  endTime,
  onSuccess,
  isExternalBooking
}: BookingRequestFormProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isGeorgian = language === 'ka';
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine event title and datetime from either direct props or date/time props
  const actualEventTitle = eventTitle || (selectedDate ? 
    `${t("events.booking")} ${selectedDate.toLocaleDateString()}` : "");
  
  const actualEventDateTime = eventDateTime || (selectedDate && startTime ? 
    `${selectedDate.toISOString().split('T')[0]} ${startTime}` : new Date().toISOString());

  const formSchema = z.object({
    fullName: z.string().min(2, { message: t("events.fullNameRequired") }),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    notes: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);

      // Check for duplicate booking requests in the last minute to prevent double submissions
      const { data: existingRequests } = await supabase
        .from('booking_requests')
        .select('id')
        .eq('business_id', businessId)
        .eq('requester_name', values.fullName)
        .eq('title', actualEventTitle)
        .eq('start_date', actualEventDateTime)
        .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Requests in the last minute
        .limit(1);

      if (existingRequests && existingRequests.length > 0) {
        toast.error({
          title: t("common.rateLimitReached"),
          description: t("common.rateLimitMessage"),
        });
        setIsSubmitting(false);
        if (onClose) {
          onClose();
        }
        return;
      }

      const newBookingRequest: Partial<BookingRequest> = {
        business_id: businessId,
        requester_name: values.fullName,
        requester_phone: values.phone || null,
        requester_email: values.email || null,
        title: actualEventTitle,
        start_date: actualEventDateTime,
        end_date: endTime ? `${selectedDate?.toISOString().split('T')[0]} ${endTime}` : actualEventDateTime,
        description: values.notes || null,
        status: 'pending',
      };

      const { error } = await supabase
        .from('booking_requests')
        .insert([newBookingRequest]);

      if (error) {
        throw error;
      }

      // Use the toast helper which is already set up with proper translations
      toast.event.bookingSubmitted();

      // Send webhook notification to business owner
      try {
        await supabase.functions.invoke('send-booking-request-notification', {
          body: { businessId }
        });
      } catch (webhookError) {
        console.error("Failed to send notification:", webhookError);
        // Continue with form submission even if notification fails
      }

      if (onSuccess) {
        onSuccess();
      }
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error submitting booking request:', error);
      toast.error({
        description: t("common.errorOccurred"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <h2 className={cn("text-lg font-semibold", isGeorgian ? "font-georgian" : "")}>
          <LanguageText>{t("events.submitBookingRequest")}</LanguageText>
        </h2>
        
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={isGeorgian ? "font-georgian" : ""}>
                <LanguageText>{t("events.fullName")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder={t("events.fullName")} 
                  {...field} 
                  className={isGeorgian ? "font-georgian" : ""}
                />
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
              <FormLabel className={isGeorgian ? "font-georgian" : ""}>
                <LanguageText>{t("events.phoneNumber")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder={t("events.phoneNumber")} 
                  {...field} 
                  className={isGeorgian ? "font-georgian" : ""}
                />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={isGeorgian ? "font-georgian" : ""}>
                <LanguageText>{t("events.socialLinkEmail")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  placeholder="email@example.com" 
                  {...field} 
                />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={isGeorgian ? "font-georgian" : ""}>
                <LanguageText>{t("events.eventNotes")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={t("events.addEventNotes")} 
                  {...field} 
                  className={isGeorgian ? "font-georgian" : ""}
                  rows={3}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="pt-2 flex justify-end">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className={cn("w-full", isGeorgian ? "font-georgian" : "")}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                <LanguageText>{t("common.submitting")}</LanguageText>
              </>
            ) : (
              <LanguageText>{t("events.submitRequest")}</LanguageText>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
