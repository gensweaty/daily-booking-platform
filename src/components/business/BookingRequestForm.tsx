import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BusinessProfile } from '@/types/database';

const bookingSchema = z.object({
  requester_name: z.string().min(1, 'Name is required'),
  requester_email: z.string().email('Valid email is required'),
  requester_phone: z.string().optional(),
  title: z.string().min(1, 'Event title is required'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  payment_status: z.string().optional(),
  payment_amount: z.number().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface BookingRequestFormProps {
  businessProfile: BusinessProfile;
  onSuccess?: () => void;
}

export const BookingRequestForm = ({ businessProfile, onSuccess }: BookingRequestFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { language, t } = useLanguage();
  
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      payment_status: 'not_paid',
      payment_amount: 0,
    },
  });

  const handleFileSelect = (file: File) => {
    setUploadedFiles(prev => [...prev, file]);
  };

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    console.log('Submitting booking request with data:', data);
    console.log('Business profile:', businessProfile);
    console.log('Language:', language);
    
    try {
      // Create the booking request
      const bookingData = {
        ...data,
        business_id: businessProfile.id,
        status: 'pending',
        language: language, // Include the current language
      };
      
      console.log('Creating booking request with data:', bookingData);
      
      const { data: booking, error: bookingError } = await supabase
        .from('booking_requests')
        .insert(bookingData)
        .select()
        .single();
      
      if (bookingError) {
        console.error('Error creating booking request:', bookingError);
        throw bookingError;
      }
      
      console.log('Booking request created successfully:', booking);
      
      // Handle file uploads if any
      if (uploadedFiles.length > 0) {
        console.log(`Processing ${uploadedFiles.length} uploaded files`);
        
        for (const file of uploadedFiles) {
          const fileName = `${booking.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          
          console.log(`Uploading file: ${file.name} to path: ${fileName}`);
          
          const { error: uploadError } = await supabase.storage
            .from('booking_attachments')
            .upload(fileName, file);
          
          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }
          
          console.log(`File uploaded successfully: ${fileName}`);
          
          // Create file record
          const { error: fileError } = await supabase
            .from('event_files')
            .insert({
              filename: file.name,
              file_path: fileName,
              content_type: file.type,
              size: file.size,
              event_id: booking.id,
            });
          
          if (fileError) {
            console.error('Error creating file record:', fileError);
            // Continue with other files even if one fails
          } else {
            console.log(`File record created for: ${file.name}`);
          }
        }
      }
      
      // Send notification email to business owner
      console.log('Sending booking request notification email to business owner');
      
      try {
        const notificationData = {
          businessId: businessProfile.id,
          requesterName: data.requester_name,
          startDate: data.start_date,
          endDate: data.end_date,
          requesterPhone: data.requester_phone || '',
          requesterEmail: data.requester_email,
          notes: data.description || '',
          businessName: businessProfile.business_name,
          hasAttachment: uploadedFiles.length > 0,
          paymentStatus: data.payment_status,
          paymentAmount: data.payment_amount,
          businessAddress: businessProfile.contact_address,
          language: language // Pass the current language for email localization
        };
        
        console.log('Calling send-booking-request-notification with data:', {
          ...notificationData,
          requesterEmail: data.requester_email.substring(0, 3) + '***' // Mask email for privacy
        });
        
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-booking-request-notification',
          {
            body: notificationData,
          }
        );
        
        if (emailError) {
          console.error('Error sending notification email:', emailError);
          // Don't throw here - the booking was created successfully
          // Just log the email error
        } else {
          console.log('Notification email sent successfully:', emailResult);
        }
      } catch (emailError) {
        console.error('Exception while sending notification email:', emailError);
        // Don't throw here - the booking was created successfully
      }
      
      // Show success message
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "bookings.requestSubmitted"
        }
      });
      
      // Reset form and uploaded files
      form.reset();
      setUploadedFiles([]);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error) {
      console.error('Error submitting booking request:', error);
      toast({
        variant: "destructive",
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        },
        description: error instanceof Error ? error.message : "An error occurred while submitting your booking request"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('bookings.requestBooking')}</CardTitle>
        <CardDescription>
          {t('bookings.fillFormToRequest')} {businessProfile.business_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requester_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookings.requesterName')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('bookings.enterYourName')} />
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
                    <FormLabel>{t('bookings.requesterEmail')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder={t('bookings.enterYourEmail')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="requester_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bookings.requesterPhone')} ({t('common.optional')})</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('bookings.enterYourPhone')} />
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
                  <FormLabel>{t('bookings.eventTitle')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('bookings.enterEventTitle')} />
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
                  <FormLabel>{t('bookings.description')} ({t('common.optional')})</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t('bookings.enterDescription')} />
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
                  <FormItem>
                    <FormLabel>{t('bookings.startDate')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="datetime-local" />
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
                    <FormLabel>{t('bookings.endDate')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="datetime-local" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookings.paymentStatus')} ({t('common.optional')})</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('bookings.selectPaymentStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_paid">{t('bookings.notPaid')}</SelectItem>
                        <SelectItem value="partly_paid">{t('bookings.partlyPaid')}</SelectItem>
                        <SelectItem value="fully_paid">{t('bookings.fullyPaid')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="payment_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookings.paymentAmount')} ({t('common.optional')})</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        placeholder="0"
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div>
              <Label>{t('bookings.attachments')} ({t('common.optional')})</Label>
              <FileUploadField
                onFileSelect={handleFileSelect}
                acceptedFileTypes="image/*,application/pdf,.doc,.docx"
                maxSizeMB={10}
              />
            </div>
            
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('bookings.submitting')}
                </>
              ) : (
                t('bookings.submitRequest')
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
