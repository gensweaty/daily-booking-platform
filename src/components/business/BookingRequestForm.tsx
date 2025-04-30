
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimePicker } from '@/components/ui/time-picker';

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
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  phone: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }),
  notes: z.string().optional(),
  paymentStatus: z.string().optional(),
  paymentAmount: z.string().optional(),
  file: z.instanceof(File).optional(),
  startTime: z.string(),
  endTime: z.string()
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
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPaymentAmount, setShowPaymentAmount] = useState(false);

  const form = useForm<z.infer<typeof bookingRequestSchema>>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      notes: '',
      paymentStatus: 'pending',
      paymentAmount: '',
      startTime: startTime,
      endTime: endTime
    },
  });

  const formatTimeForDisplay = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const h = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${h.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const combineDateAndTime = (date: Date, timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setFileError('');
  };
  
  const handlePaymentStatusChange = (value: string) => {
    form.setValue('paymentStatus', value);
    setShowPaymentAmount(value === 'partial' || value === 'paid');
    if (value === 'pending') {
      form.setValue('paymentAmount', '');
    }
  };

  const onSubmit = async (values: z.infer<typeof bookingRequestSchema>) => {
    try {
      setIsSubmitting(true);
      const startDateTime = combineDateAndTime(selectedDate, values.startTime);
      const endDateTime = combineDateAndTime(selectedDate, values.endTime);

      const bookingData = {
        business_id: businessId,
        requester_name: values.fullName,
        requester_email: values.email,
        requester_phone: values.phone || null,
        title: `Booking Request - ${values.fullName}`,
        description: values.notes || null,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        status: 'pending',
        payment_status: values.paymentStatus || 'pending',
        payment_amount: values.paymentAmount ? parseFloat(values.paymentAmount) : null
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
              requesterName: values.fullName,
              requesterEmail: values.email,
              requesterPhone: values.phone || "Not provided",
              notes: values.notes || "No additional notes",
              startDate: startDateTime.toISOString(),
              endDate: endDateTime.toISOString(),
              hasAttachment: !!selectedFile
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
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Full Name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('Enter your full name')} {...field} />
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
                <FormLabel>{t('Email')}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder={t('Enter your email')} {...field} />
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
                <FormLabel>{t('Phone')} ({t('optional')})</FormLabel>
                <FormControl>
                  <Input placeholder={t('Enter your phone number')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Start Time')}</FormLabel>
                  <div className="flex">
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal flex justify-between items-center",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {formatTimeForDisplay(field.value) || "Select time"}
                            <Clock className="h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <TimePicker 
                          setTime={(time) => field.onChange(time)}
                          current={field.value}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('End Time')}</FormLabel>
                  <div className="flex">
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal flex justify-between items-center",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {formatTimeForDisplay(field.value) || "Select time"}
                            <Clock className="h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <TimePicker 
                          setTime={(time) => field.onChange(time)}
                          current={field.value}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
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
                <FormLabel>{t('Payment Status')}</FormLabel>
                <Select onValueChange={handlePaymentStatusChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select payment status')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">{t('Not Paid')}</SelectItem>
                    <SelectItem value="partial">{t('Partly Paid')}</SelectItem>
                    <SelectItem value="paid">{t('Fully Paid')}</SelectItem>
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
                  <FormLabel>{t('Payment Amount')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder={t('Enter payment amount')} 
                      {...field} 
                    />
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
                <FormLabel>{t('Notes')} ({t('optional')})</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder={t('Add any additional information')} 
                    className="resize-none" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="file"
            render={() => (
              <FormItem>
                <FormLabel>{t('Attach file')} ({t('optional')})</FormLabel>
                <FormControl>
                  <FileUploadField
                    onFileChange={handleFileChange}
                    fileError={fileError}
                    setFileError={setFileError}
                    ref={fileInputRef}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
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
