import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';  // Fixed supabase import path
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTheme } from "next-themes";

export interface BookingRequestFormProps {
  businessId: string;
  businessName?: string;
  businessOwnerUserId?: string;
  date?: Date;
  defaultDuration?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  // Add these props to make it compatible with Calendar component usage
  startTime?: string;
  endTime?: string;
  selectedDate?: Date;
  isExternalBooking?: boolean;
}

interface ServiceItem {
  id: string;
  name: string;
  business_id: string;
  created_at: string;
  deleted_at: string | null;
}

export const BookingRequestForm = ({
  businessId,
  businessName,
  businessOwnerUserId,
  date,
  defaultDuration = 60,
  open,
  onSuccess,
  onOpenChange
}: BookingRequestFormProps) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isGeorgian = language === 'ka';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();

  // Form fields
  const [title, setTitle] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [description, setDescription] = useState('');
  const [service, setService] = useState('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('not_paid');
  const [paymentAmount, setPaymentAmount] = useState('');

  // Move date initialization to useEffect
  useEffect(() => {
    if (date) {
      // Initialize with the provided date 
      const newStartDate = new Date(date);
      
      // Round to nearest half hour for better UX
      const minutes = newStartDate.getMinutes();
      newStartDate.setMinutes(minutes < 30 ? 30 : 60);
      newStartDate.setSeconds(0);
      newStartDate.setMilliseconds(0);
      
      // Calculate end date based on defaultDuration
      const newEndDate = new Date(newStartDate.getTime() + defaultDuration * 60000);
      
      // Format dates for input
      setStartDate(format(newStartDate, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(newEndDate, "yyyy-MM-dd'T'HH:mm"));
    } else {
      // Initialize with current date and time if no date provided
      const now = new Date();
      
      // Round to nearest half hour
      const minutes = now.getMinutes();
      now.setMinutes(minutes < 30 ? 30 : 60);
      now.setSeconds(0);
      now.setMilliseconds(0);
      
      // Calculate end date based on defaultDuration
      const endTime = new Date(now.getTime() + defaultDuration * 60000);
      
      // Format dates for input
      setStartDate(format(now, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(endTime, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [date, defaultDuration]);

  // Reset form on open/close
  useEffect(() => {
    if (open) {
      setTitle('');
      setRequesterName('');
      setRequesterPhone('');
      setRequesterEmail('');
      setDescription('');
      setService('');
      setSelectedFile(null);
      setFileError('');
    }
  }, [open]);

  // Fetch services for the business
  useEffect(() => {
    const fetchServices = async () => {
      if (businessId) {
        try {
          // Fix: Don't use "services" as a direct parameter for from()
          const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('business_id', businessId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Error fetching services:', error);
            return;
          }

          // Use type assertion to ensure correct type
          setServices(data as ServiceItem[] || []);
          
          // If there are services, set the first one as default
          if (data && data.length > 0) {
            setService(data[0].id);
          }
        } catch (err) {
          console.error('Exception fetching services:', err);
        }
      }
    };

    fetchServices();
  }, [businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form
      if (!requesterName) {
        toast({
          title: t("common.error"),
          description: t("bookings.nameRequired"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Create the booking request
      const bookingData = {
        business_id: businessId,
        title: title || requesterName,
        requester_name: requesterName,
        requester_phone: requesterPhone,
        requester_email: requesterEmail,
        description,
        service_id: service || null,
        start_date: startDate,
        end_date: endDate,
        status: 'pending', // Initial status is always pending
      };

      const { data: bookingRequest, error: bookingError } = await supabase
        .from('booking_requests')
        .insert(bookingData)
        .select()
        .single();

      if (bookingError) {
        console.error('Error creating booking request:', bookingError);
        toast({
          title: t("common.error"),
          description: t("bookings.errorCreating"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Upload file if selected
      if (selectedFile && bookingRequest.id) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${bookingRequest.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          // Continue with the booking process even if file upload fails
        } else {
          // Create file record in booking_files table
          const { error: fileRecordError } = await supabase
            .from('booking_files')
            .insert({
              booking_id: bookingRequest.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size
            });

          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
          }
        }
      }

      // Send notification to business owner if we have their user ID
      try {
        if (businessOwnerUserId) {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          
          if (accessToken) {
            const response = await fetch(
              "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                  businessOwnerId: businessOwnerUserId,
                  businessName: businessName || "Your business",
                  requesterName: requesterName,
                  startDate: startDate,
                  bookingId: bookingRequest.id
                }),
              }
            );
            
            if (!response.ok) {
              console.error("Failed to send notification");
            }
          }
        }
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
        // Continue with success flow even if notification fails
      }

      // Show success message and close dialog
      toast({
        title: t("common.success"),
        description: t("bookings.requestSent"),
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      onOpenChange(false);
    } catch (err) {
      console.error('Exception submitting booking request:', err);
      toast({
        title: t("common.error"),
        description: t("bookings.errorSubmitting"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const serviceOptions = services.map(service => (
    <SelectItem key={service.id} value={service.id}>
      {service.name}
    </SelectItem>
  ));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("bookings.requestBooking")} {businessName ? `- ${businessName}` : ''}
        </DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="requesterName" className={cn("block font-medium", isGeorgian ? "font-georgian" : "")}>
              {t("bookings.fullName")}
            </Label>
            <Input
              id="requesterName"
              value={requesterName}
              onChange={(e) => {
                setRequesterName(e.target.value);
                if (!title) setTitle(e.target.value); // Set title to name if title is empty
              }}
              placeholder={t("bookings.fullName")}
              required
            />
          </div>
          <div>
            <Label htmlFor="requesterPhone" className={cn("block font-medium", isGeorgian ? "font-georgian" : "")}>
              {t("bookings.phoneNumber")}
            </Label>
            <Input
              id="requesterPhone"
              value={requesterPhone}
              onChange={(e) => setRequesterPhone(e.target.value)}
              placeholder={t("bookings.phoneNumber")}
            />
          </div>
          <div>
            <Label htmlFor="requesterEmail" className={cn("block font-medium", isGeorgian ? "font-georgian" : "")}>
              {t("bookings.email")}
            </Label>
            <Input
              id="requesterEmail"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              type="email"
              placeholder="email@example.com"
            />
          </div>
          {services.length > 0 && (
            <div>
              <Label htmlFor="service" className={cn("block font-medium", isGeorgian ? "font-georgian" : "")}>
                {t("bookings.service")}
              </Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger id="service" className={isGeorgian ? "font-georgian" : ""}>
                  <SelectValue placeholder={t("bookings.selectService")} />
                </SelectTrigger>
                <SelectContent>
                  {serviceOptions}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="dateTime" className={cn("block font-medium", isGeorgian ? "font-georgian" : "")}>
              {t("bookings.dateAndTime")}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                  {t("bookings.start")}
                </Label>
                <div className="relative">
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full"
                    style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                  {t("bookings.end")}
                </Label>
                <div className="relative">
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full"
                    style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="description" className={cn("block font-medium", isGeorgian ? "font-georgian" : "")}>
              {t("bookings.notes")}
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("bookings.bookingNotes")}
              className="min-h-[100px] resize-none"
            />
          </div>
          <div>
            <Label htmlFor="file" className={cn("block font-medium", isGeorgian ? "font-georgian" : "")}>
              <LanguageText>{t("bookings.attachments")}</LanguageText>
            </Label>
            <FileUploadField
              onChange={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              acceptedFileTypes=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              selectedFile={selectedFile}
              hideLabel={true}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'en' && "Supported formats: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT"}
              {language === 'es' && "Formatos admitidos: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT"}
              {language === 'ka' && "მხარდაჭერილი ფორმატები: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT"}
            </p>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.submitting") : t("bookings.sendRequest")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
