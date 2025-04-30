
import { useState, useRef } from 'react';
import { z } from 'zod';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export interface BookingRequestFormProps {
  businessId: string;
  selectedDate: Date;
  startTime?: string;
  endTime?: string;
  onSuccess?: () => void;
  isExternalBooking?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const bookingRequestSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }),
  notes: z.string().optional(),
  paymentStatus: z.string().optional(),
  file: z.instanceof(File).optional()
});

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  startTime = '09:00',
  endTime = '10:00',
  onSuccess,
  isExternalBooking = false,
  open,
  onOpenChange
}: BookingRequestFormProps) => {
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add state for payment status
  const [paymentStatus, setPaymentStatus] = useState('not_paid');
  
  // Convert date+time strings to actual dates for datetime-local input format
  const combineDateAndTime = (date: Date, timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  };
  
  const initialStartDate = combineDateAndTime(selectedDate, startTime);
  const initialEndDate = combineDateAndTime(selectedDate, endTime);
  
  // Add state for proper date/time handling in datetime-local inputs
  const [startDate, setStartDate] = useState(format(initialStartDate, "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState(format(initialEndDate, "yyyy-MM-dd'T'HH:mm"));
  
  // Add state for title and userSurname - these are the same value
  const [userSurname, setUserSurname] = useState('');

  const form = useForm<z.infer<typeof bookingRequestSchema>>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      notes: '',
      paymentStatus: 'not_paid',
    },
  });

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setFileError('');
  };

  const onSubmit = async (values: z.infer<typeof bookingRequestSchema>) => {
    try {
      setIsSubmitting(true);
      // Use the datetime-local input values directly
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);

      const bookingData = {
        business_id: businessId,
        requester_name: userSurname, // Use userSurname instead of values.name
        requester_email: values.email,
        requester_phone: values.phone || null,
        title: `Booking Request - ${userSurname}`, // Use userSurname for consistency
        description: values.notes || null,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        status: 'pending',
        payment_status: paymentStatus, // Include payment status
        user_surname: userSurname // Add user_surname field
      };

      console.log('Submitting booking request:', bookingData);

      const { data, error } = await supabase
        .from('booking_requests')
        .insert(bookingData)
        .select()
        .single();

      if (error) {
        console.error('Error submitting booking request:', error);
        throw error;
      }

      const bookingId = data.id;

      if (selectedFile && bookingId) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${bookingId}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('booking_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }

          console.log('File uploaded successfully to path:', filePath);

          const fileRecord = {
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            event_id: bookingId
          };

          const { error: fileRecordError } = await supabase
            .from('event_files')
            .insert(fileRecord);

          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
          } else {
            console.log('File record created successfully in event_files');
          }
        } catch (fileError) {
          console.error('Error handling file upload:', fileError);
        }
      }

      console.log('Booking request submitted successfully!');
      setIsSubmitting(false);
      form.reset();
      setSelectedFile(null);
      setUserSurname('');
      setPaymentStatus('not_paid');
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast({
        title: t('common.success'),
        description: t('Your booking request has been submitted successfully')
      });

      if (onSuccess) {
        onSuccess();
      }

      if (onOpenChange) {
        onOpenChange(false);
      }

      try {
        await fetch(
          "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: businessId,
              requesterName: userSurname,
              requesterEmail: values.email,
              requesterPhone: values.phone || "Not provided",
              notes: values.notes || "No additional notes",
              startDate: startDateTime.toISOString(),
              endDate: endDateTime.toISOString(),
              hasAttachment: !!selectedFile,
              paymentStatus: paymentStatus
            }),
          }
        );
        console.log("Email notification sent to business owner");
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      setIsSubmitting(false);
      toast({
        title: t('common.error'),
        description: t('There was a problem submitting your request. Please try again.'),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-4 p-1">
      <h3 className="text-xl font-semibold">
        {t('Book appointment')}
      </h3>
      
      <p className="text-sm text-muted-foreground">
        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("events.fullName")}</Label>
            <Input
              id="fullName"
              placeholder={t("events.fullName")}
              value={userSurname}
              onChange={(e) => setUserSurname(e.target.value)}
              required
              className="w-full"
            />
            <FormMessage className="text-destructive text-xs" />
          </div>
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.socialLinkEmail')}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" {...field} />
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
                <FormLabel>{t('events.phoneNumber')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('events.phoneNumber')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="space-y-2">
            <Label htmlFor="dateTime">{t("events.dateAndTime")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                  {t("events.start")}
                </Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                  {t("events.end")}
                </Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="paymentStatus">{t("events.paymentStatus")}</Label>
            <Select
              value={paymentStatus}
              onValueChange={setPaymentStatus}
            >
              <SelectTrigger id="paymentStatus">
                <SelectValue placeholder={t("events.selectPaymentStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
                <SelectItem value="partly_paid">{t("crm.paidPartly")}</SelectItem>
                <SelectItem value="fully_paid">{t("crm.paidFully")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.eventNotes')}</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder={t('events.addEventNotes')} 
                    className="resize-none min-h-[100px]" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label>{t('common.attachments')}</Label>
            <FileUploadField
              onFileChange={handleFileChange}
              fileError={fileError}
              setFileError={setFileError}
              ref={fileInputRef}
            />
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('Submitting...') : t('Submit Request')}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default BookingRequestForm;
