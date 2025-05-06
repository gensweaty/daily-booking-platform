
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { FileUploadField } from "../shared/FileUploadField";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// Time in milliseconds for rate limiting
const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutes

interface BookingRequestFormProps {
  businessId: string;
  businessName?: string;
  businessEmail?: string | null;
  startDate: Date;
  endDate?: Date;
  onSuccess?: () => void;
  onCancel?: () => void;
  // Add dialog props
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Add time props
  startTime?: string;
  endTime?: string;
  // Add external booking flag
  isExternalBooking?: boolean;
  selectedDate?: Date;
}

export const BookingRequestForm: React.FC<BookingRequestFormProps> = ({
  businessId,
  businessName,
  businessEmail,
  startDate,
  endDate,
  onSuccess,
  onCancel,
  open,
  onOpenChange,
  startTime,
  endTime,
  isExternalBooking,
  selectedDate,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [lastSubmitTime, setLastSubmitTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  // Use selectedDate and times if provided
  const effectiveStartDate = selectedDate || startDate;
  const effectiveEndDate = endDate || selectedDate || startDate;

  // If start/end times are provided, update the dates
  useEffect(() => {
    if (selectedDate && startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      effectiveStartDate.setHours(hours, minutes, 0, 0);
    }
    
    if (selectedDate && endTime) {
      const [hours, minutes] = endTime.split(':').map(Number);
      if (effectiveEndDate) {
        effectiveEndDate.setHours(hours, minutes, 0, 0);
      }
    }
  }, [selectedDate, startTime, endTime]);

  // Check for rate limiting based on localStorage
  useEffect(() => {
    const storedTime = localStorage.getItem("lastBookingSubmit");
    if (storedTime) {
      const parsedTime = parseInt(storedTime, 10);
      setLastSubmitTime(parsedTime);
      
      // Calculate time remaining in the rate limit period
      const elapsed = Date.now() - parsedTime;
      if (elapsed < RATE_LIMIT_MS) {
        setTimeRemaining(Math.ceil((RATE_LIMIT_MS - elapsed) / 1000));
      }
    }
  }, []);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check rate limiting
    if (lastSubmitTime) {
      const elapsed = Date.now() - lastSubmitTime;
      if (elapsed < RATE_LIMIT_MS) {
        const remainingSecs = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
        toast.error({ description: t("common.waitBeforeBooking").replace("{time}", `${Math.floor(remainingSecs / 60)}:${(remainingSecs % 60).toString().padStart(2, '0')}`) });
        setTimeRemaining(remainingSecs);
        return;
      }
    }
    
    if (!name.trim()) {
      toast.error({ description: t("events.fullNameRequired") });
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Create booking request
      const { data: bookingRequest, error } = await supabase
        .from('booking_requests')
        .insert([
          {
            business_id: businessId,
            title: name,
            type: 'booking_request',
            requester_name: name,
            requester_email: email,
            requester_phone: phone,
            description: notes || 'No additional notes',
            start_date: effectiveStartDate.toISOString(),
            end_date: effectiveEndDate.toISOString(),
            status: 'pending',
            payment_status: 'not_paid',
          }
        ])
        .select()
        .single();
        
      if (error) {
        console.error('Error submitting booking request:', error);
        toast.error({ description: error.message });
        setSubmitting(false);
        return;
      }
      
      console.log('Booking request submitted:', bookingRequest);
      
      // Handle file upload if present
      if (selectedFile && bookingRequest?.id) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${bookingRequest.id}/${crypto.randomUUID()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('booking_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            // Continue despite file upload error
          } else {
            // Create file record
            await supabase
              .from('booking_files')
              .insert({
                booking_request_id: bookingRequest.id,
                filename: selectedFile.name,
                file_path: filePath,
                content_type: selectedFile.type,
                size: selectedFile.size
              });
          }
        } catch (fileError) {
          console.error('Error with file upload:', fileError);
          // Continue despite errors
        }
      }
      
      // Call edge function to send notification email
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-request-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            businessId,
            businessEmail,
            requesterName: name,
            requesterEmail: email,
            requesterPhone: phone,
            notes: notes || 'No additional notes',
            startDate: effectiveStartDate.toISOString(),
            endDate: effectiveEndDate.toISOString(),
            hasAttachment: !!selectedFile,
            paymentStatus: 'not_paid',
            paymentAmount: null,
            businessName: businessName || ''
          })
        });
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // Continue despite email error
      }
      
      // Update local storage for rate limiting
      localStorage.setItem("lastBookingSubmit", Date.now().toString());
      
      // Use the correct toast notification with proper translation keys
      toast.event.bookingSubmitted();
      
      // Reset form and call success handler
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setSelectedFile(null);
      setSubmitting(false);
      
      // Close dialog if onOpenChange is provided
      if (onOpenChange) {
        onOpenChange(false);
      }
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (err) {
      console.error('Exception submitting booking:', err);
      toast.error({ description: t("common.errorOccurred") });
      setSubmitting(false);
    }
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className={cn("block text-sm font-medium mb-1", isGeorgian && "font-georgian")}>
          {t("events.fullName")}
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full"
          placeholder={t("events.fullName")}
          disabled={submitting || timeRemaining > 0}
        />
      </div>
      
      <div>
        <label htmlFor="email" className={cn("block text-sm font-medium mb-1", isGeorgian && "font-georgian")}>
          {t("contact.email")}
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full"
          placeholder="email@example.com"
          disabled={submitting || timeRemaining > 0}
        />
      </div>
      
      <div>
        <label htmlFor="phone" className={cn("block text-sm font-medium mb-1", isGeorgian && "font-georgian")}>
          {t("events.phoneNumber")}
        </label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full"
          placeholder="+1234567890"
          disabled={submitting || timeRemaining > 0}
        />
      </div>
      
      <div>
        <label htmlFor="notes" className={cn("block text-sm font-medium mb-1", isGeorgian && "font-georgian")}>
          {t("events.eventNotes")}
        </label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full"
          placeholder={t("events.addEventNotes")}
          disabled={submitting || timeRemaining > 0}
        />
      </div>
      
      <FileUploadField
        selectedFile={selectedFile}
        onFileChange={handleFileChange}
        fileError={fileError}
        setFileError={setFileError}
        disabled={submitting || timeRemaining > 0}
      />
      
      <div className="flex justify-between gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full"
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
        )}
        
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || timeRemaining > 0}
        >
          {submitting ? t("common.submitting") : (
            timeRemaining > 0 
              ? `${t("common.waitTimeRemaining")} ${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`
              : t("events.submitRequest")
          )}
        </Button>
      </div>
    </form>
  );
};
