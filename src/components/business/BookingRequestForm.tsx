
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { FileUploadField } from '../shared/FileUploadField';

export interface BookingRequestFormProps {
  businessId: string | undefined;
  onRequestSubmitted?: () => void;
  businessSlug?: string;
  businessName?: string;
  selectedDate?: Date;
  startTime?: string;
  endTime?: string;
  isExternalBooking?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export const BookingRequestForm = ({
  businessId,
  onRequestSubmitted,
  businessSlug,
  businessName,
  selectedDate,
  startTime: initialStartTime = '09:00',
  endTime: initialEndTime = '10:00',
  isExternalBooking,
  onOpenChange,
  onSuccess
}: BookingRequestFormProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(selectedDate ? selectedDate.toISOString().split('T')[0] : '');
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [bookingRequestId, setBookingRequestId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;

    setIsSubmitting(true);

    try {
      const startDate = combineDateTime(date, startTime);
      const endDate = combineDateTime(date, endTime);

      // First create the booking request
      const { data, error } = await supabase
        .from('booking_requests')
        .insert({
          business_id: businessId,
          requester_name: name,
          requester_email: email,
          requester_phone: phone,
          title: name, // Use requester name as the title for consistency
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          description,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Store the booking request ID for file upload
      const newRequestId = data.id;
      setBookingRequestId(newRequestId);
      console.log(`Created booking request: ${newRequestId}`);

      // Handle file upload if a file is selected
      if (selectedFile) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${crypto.randomUUID()}.${fileExt}`;
          
          console.log(`Uploading file: ${filePath} for booking request: ${newRequestId}`);
          
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }

          const fileData = {
            event_id: newRequestId,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: null
          };

          // Save file record - this will now be visible in both event and booking views
          const { error: fileRecordError } = await supabase
            .from('event_files')
            .insert(fileData);
            
          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
            throw fileRecordError;
          }

          console.log('File record created successfully for booking request');
        } catch (fileError) {
          console.error("Error handling file upload:", fileError);
        }
      }

      // Send notification to business owner
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        
        if (accessToken) {
          await fetch("https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              businessId,
              requesterName: name,
              requesterEmail: email,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              businessName: businessName || ''
            })
          });
        }
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
      }

      // Reset form
      setName('');
      setEmail('');
      setPhone('');
      setDate('');
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setDescription('');
      setSelectedFile(null);

      // Show success notification
      toast({
        title: t('business.requestSuccessTitle'),
        description: t('business.requestSuccessDescription'),
      });

      // Call callbacks
      if (onRequestSubmitted) {
        onRequestSubmitted();
      }
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Close the dialog if we're in a dialog
      if (onOpenChange) {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Error submitting booking request:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('business.requestFailure'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const combineDateTime = (date: string, time: string): Date => {
    const [year, month, day] = date.split('-').map(num => parseInt(num));
    const [hours, minutes] = time.split(':').map(num => parseInt(num));
    return new Date(year, month - 1, day, hours, minutes);
  };

  const today = new Date();
  const formattedToday = today.toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          {t('business.name')}
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('business.namePlaceholder')}
          required
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {t('business.email')}
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('business.emailPlaceholder')}
          required
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          {t('business.phone')}
        </label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('business.phonePlaceholder')}
        />
      </div>
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700">
          {t('business.date')}
        </label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={formattedToday}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">
            {t('business.startTime')}
          </label>
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">
            {t('business.endTime')}
          </label>
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          {t('business.description')}
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('business.descriptionPlaceholder')}
          rows={4}
        />
      </div>
      
      <div>
        <FileUploadField 
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
          bookingRequestId={bookingRequestId || undefined}
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Spinner className="mr-2 h-4 w-4" /> {t('business.submitting')}
          </>
        ) : (
          t('business.submitRequest')
        )}
      </Button>
    </form>
  );
};
