// Make sure translation keys are properly used in the BookingRequestForm component
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface BookingRequestFormProps {
  businessId: string;
  selectedDate?: Date;
  onSuccess?: () => void;
  onCancel?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  startTime?: string;
  endTime?: string;
  isExternalBooking?: boolean;
}

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  onSuccess,
  onCancel,
  open,
  onOpenChange,
  startTime,
  endTime,
  isExternalBooking
}: BookingRequestFormProps) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  useEffect(() => {
    const checkRateLimit = async () => {
      if (!businessId) return;
      
      try {
        const lastRequestTime = localStorage.getItem(`booking_last_request_${businessId}`);
        if (lastRequestTime) {
          const now = new Date();
          const lastRequest = new Date(parseInt(lastRequestTime));
          const timeSinceLastRequest = now.getTime() - lastRequest.getTime();
          const twoMinutesInMs = 2 * 60 * 1000;
          
          if (timeSinceLastRequest < twoMinutesInMs) {
            setRateLimitExceeded(true);
            const remaining = Math.ceil((twoMinutesInMs - timeSinceLastRequest) / 1000);
            setTimeRemaining(remaining);
          }
        }
      } catch (error) {
        console.error('Error checking rate limit:', error);
      }
    };
    
    checkRateLimit();
  }, [businessId]);

  useEffect(() => {
    if (!rateLimitExceeded || timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          setRateLimitExceeded(false);
          clearInterval(timer);
        }
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [rateLimitExceeded, timeRemaining]);

  useEffect(() => {
    if (selectedDate) {
      const startTime = new Date(selectedDate);
      startTime.setHours(10, 0, 0, 0);
      
      const endTime = new Date(selectedDate);
      endTime.setHours(11, 0, 0, 0);
      
      setStartDate(format(startTime, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(endTime, "yyyy-MM-dd'T'HH:mm"));
    } else {
      const now = new Date();
      const startTime = new Date(now);
      startTime.setHours(10, 0, 0, 0);
      startTime.setDate(startTime.getDate() + 1);
      
      const endTime = new Date(startTime);
      endTime.setHours(11, 0, 0, 0);
      
      setStartDate(format(startTime, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(endTime, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || rateLimitExceeded) return;
    
    if (!fullName) {
      toast({
        title: t("common.error"),
        description: "Please enter your full name",
        variant: "destructive",
      });
      return;
    }
    
    if (!startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: "Please select start and end times",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const lastRequestTime = localStorage.getItem(`booking_last_request_${businessId}`);
      if (lastRequestTime) {
        const now = new Date();
        const lastRequest = new Date(parseInt(lastRequestTime));
        const timeSinceLastRequest = now.getTime() - lastRequest.getTime();
        const twoMinutesInMs = 2 * 60 * 1000;
        
        if (timeSinceLastRequest < twoMinutesInMs) {
          const remainingSecs = Math.ceil((twoMinutesInMs - timeSinceLastRequest) / 1000);
          const remainingTime = `${Math.floor(remainingSecs / 60)}:${(remainingSecs % 60).toString().padStart(2, '0')}`;
          
          setRateLimitExceeded(true);
          setTimeRemaining(remainingSecs);
          
          toast({
            title: t("common.rateLimitReached"),
            description: t("common.waitBeforeBooking", { time: remainingTime }),
            variant: "destructive",
          });
          
          setIsSubmitting(false);
          return;
        }
      }
      
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      
      console.log(`Creating booking request for business: ${businessId}`);
      const { data, error } = await supabase
        .from('booking_requests')
        .insert({
          business_id: businessId,
          title: fullName,
          requester_name: fullName,
          requester_email: email,
          requester_phone: phone,
          description: notes,
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          status: 'pending'
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error creating booking request:", error);
        throw error;
      }
      
      console.log("Successfully created booking request:", data);

      localStorage.setItem(`booking_last_request_${businessId}`, Date.now().toString());

      try {
        console.log("Fetching business email for business ID:", businessId);
        const { data: businessData, error: businessError } = await supabase
          .from('business_profiles')
          .select('user_email, business_name')
          .eq('id', businessId)
          .single();

        if (businessError || !businessData?.user_email) {
          console.error('Error fetching business email:', businessError);
          console.log('Business data:', businessData);
          throw new Error('Could not retrieve business email');
        }
        
        console.log('Business email found:', businessData.user_email);
        
        const notificationBody = {
          businessEmail: businessData.user_email,
          requesterName: fullName,
          requestDate: format(startDateTime, "MMMM dd, yyyy 'at' h:mm a"),
          phoneNumber: phone || '',
          notes: notes || ''
        };
        
        console.log('Invoking send-booking-request-notification function with params:', notificationBody);
        
        const { data: emailResponse, error: emailError } = await supabase.functions.invoke(
          'send-booking-request-notification',
          {
            body: notificationBody,
          }
        );

        if (emailError) {
          console.error('Error sending notification email:', emailError);
        } else {
          console.log('Notification email sent successfully:', emailResponse);
        }
      } catch (emailError) {
        console.error('Error in email notification process:', emailError);
      }
      
      if (selectedFile && data) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `booking_${data.id}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);
          
        if (uploadError) {
          console.error('Error uploading file:', uploadError);
        } else {
          const { error: fileError } = await supabase
            .from('booking_files')
            .insert({
              booking_request_id: data.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size
            });
            
          if (fileError) {
            console.error('Error saving file metadata:', fileError);
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['business-bookings'] });
      
      toast({
        title: t("common.success"),
        description: t("booking.requestSubmitted"),
      });
      
      setFullName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setSelectedFile(null);
      
      if (onSuccess) {
        onSuccess();
      }
      
      setRateLimitExceeded(true);
      setTimeRemaining(120);
    } catch (error: any) {
      console.error('Error submitting booking request:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.error"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {rateLimitExceeded && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-yellow-800 mb-4">
          <p className="font-medium">{t("common.rateLimitReached")}</p>
          <p className="text-sm">{t("common.rateLimitMessage")}</p>
          <p className="font-medium mt-1">
            {t("common.waitTimeRemaining")}: {formatTimeRemaining()}
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="name">{t("events.fullNameRequired")} *</Label>
        <Input
          id="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t("events.fullName")}
          required
          disabled={isSubmitting || rateLimitExceeded}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">{t("contact.email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          disabled={isSubmitting || rateLimitExceeded}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">{t("events.phoneNumber")}</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("events.phoneNumber")}
          disabled={isSubmitting || rateLimitExceeded}
        />
      </div>
      
      <div className="space-y-2">
        <Label>{t("events.dateAndTime")} *</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start-date" className="text-sm text-muted-foreground">
              {t("events.startDateTime")}
            </Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
              required
              disabled={isSubmitting || rateLimitExceeded}
            />
          </div>
          <div>
            <Label htmlFor="end-date" className="text-sm text-muted-foreground">
              {t("events.endDateTime")}
            </Label>
            <Input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
              required
              disabled={isSubmitting || rateLimitExceeded}
            />
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">{t("events.eventNotes")}</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("events.addEventNotes")}
          className="min-h-[100px]"
          disabled={isSubmitting || rateLimitExceeded}
        />
      </div>
      
      <FileUploadField
        onChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
        disabled={isSubmitting || rateLimitExceeded}
      />
      
      <div className="flex justify-end space-x-2 pt-4">
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={isSubmitting || rateLimitExceeded}
          className="bg-primary text-white"
        >
          {isSubmitting ? t("common.submitting") : t("events.submitBookingRequest")}
        </Button>
      </div>
    </form>
  );
};
