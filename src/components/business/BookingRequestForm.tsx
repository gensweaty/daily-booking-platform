
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarEventType } from '@/lib/types/calendar';

// Define props interface with all required properties
interface BookingRequestFormProps {
  businessId: string;
  selectedDate?: Date;
  startTime?: string;
  endTime?: string;
  onSuccess?: () => void;
  isExternalBooking?: boolean;
}

export const BookingRequestForm = ({ 
  businessId, 
  selectedDate,
  startTime,
  endTime,
  onSuccess,
  isExternalBooking = false
}: BookingRequestFormProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = z.object({
    requester_name: z.string().min(2, {
      message: t("validation.nameRequired"),
    }),
    requester_phone: z.string().min(5, {
      message: t("validation.phoneRequired"),
    }),
    requester_email: z.string().email({
      message: t("validation.emailInvalid"),
    }),
    description: z.string().optional(),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { toast } = useToast();

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      if (!businessId || !selectedDate || !startTime || !endTime) {
        console.error("Missing required props:", { businessId, selectedDate, startTime, endTime });
        toast({
          title: t("common.error"),
          description: t("validation.missingFields"),
        });
        return;
      }

      const startDateTime = new Date(selectedDate);
      const [hours, minutes] = startTime.split(':').map(Number);
      startDateTime.setHours(hours, minutes, 0, 0);

      const endDateTime = new Date(selectedDate);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      // Create the booking request object
      // Note: We're using a separate object with the specific fields
      // needed for the booking_requests table
      const newBookingRequest = {
        business_id: businessId,
        title: data.requester_name,
        requester_name: data.requester_name,
        requester_phone: data.requester_phone,
        requester_email: data.requester_email,
        description: data.description,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        type: 'booking_request',
        user_id: '',
        payment_status: 'not_paid',
        payment_amount: 0,
      };

      const { error } = await supabase
        .from('booking_requests')
        .insert(newBookingRequest);

      if (error) {
        console.error("Error submitting booking request:", error);
        toast({
          title: t("common.error"),
          description: t("validation.requestFailed"),
        });
      } else {
        toast({
          title: t("common.success"),
          description: t("validation.requestSubmitted"),
        });
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error("Error during booking request submission:", error);
      toast({
        title: t("common.error"),
        description: t("validation.requestFailed"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="requester_name" className="block text-sm font-medium text-gray-700">
          {isGeorgian ? <GeorgianAuthText>თქვენი სახელი</GeorgianAuthText> : <LanguageText>{t("booking.yourName")}</LanguageText>}
        </label>
        <Input
          type="text"
          id="requester_name"
          {...register("requester_name")}
          className={cn("mt-1 block w-full dark:text-white", isGeorgian ? "font-georgian" : "")}
        />
        {errors.requester_name && (
          <p className="text-red-500 text-xs mt-1">{errors.requester_name.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="requester_phone" className="block text-sm font-medium text-gray-700">
          {isGeorgian ? <GeorgianAuthText>თქვენი ტელეფონი</GeorgianAuthText> : <LanguageText>{t("booking.yourPhone")}</LanguageText>}
        </label>
        <Input
          type="tel"
          id="requester_phone"
          {...register("requester_phone")}
          className={cn("mt-1 block w-full dark:text-white", isGeorgian ? "font-georgian" : "")}
        />
        {errors.requester_phone && (
          <p className="text-red-500 text-xs mt-1">{errors.requester_phone.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="requester_email" className="block text-sm font-medium text-gray-700">
          {isGeorgian ? <GeorgianAuthText>თქვენი ელ. ფოსტა</GeorgianAuthText> : <LanguageText>{t("booking.yourEmail")}</LanguageText>}
        </label>
        <Input
          type="email"
          id="requester_email"
          {...register("requester_email")}
          className={cn("mt-1 block w-full dark:text-white", isGeorgian ? "font-georgian" : "")}
        />
        {errors.requester_email && (
          <p className="text-red-500 text-xs mt-1">{errors.requester_email.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          {isGeorgian ? <GeorgianAuthText>აღწერა</GeorgianAuthText> : <LanguageText>{t("booking.description")}</LanguageText>}
        </label>
        <Textarea
          id="description"
          {...register("description")}
          rows={3}
          className={cn("mt-1 block w-full dark:text-white", isGeorgian ? "font-georgian" : "")}
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          isGeorgian ? <GeorgianAuthText>გაგზავნა...</GeorgianAuthText> : <LanguageText>{t("booking.submitting")}</LanguageText>
        ) : (
          isGeorgian ? <GeorgianAuthText>გაგზავნა</GeorgianAuthText> : <LanguageText>{t("booking.submit")}</LanguageText>
        )}
      </Button>
    </form>
  );
};
