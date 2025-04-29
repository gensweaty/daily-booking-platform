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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentStatus } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

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
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const { user } = useAuth(); // Add the user from auth context
  const isGeorgian = language === 'ka';
  
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";

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

  const getBusinessEmail = async (businessId: string): Promise<string> => {
    console.log("Getting business email for ID:", businessId);
    
    try {
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('user_id, contact_email')
        .eq('id', businessId)
        .maybeSingle();
      
      if (businessError) {
        console.error("Error getting business data:", businessError);
        throw new Error("Could not find business information");
      }
      
      console.log("Business data retrieved:", businessData);
      
      if (businessData?.contact_email && businessData.contact_email.includes('@')) {
        console.log("Using contact_email from business profile:", businessData.contact_email);
        return businessData.contact_email;
      }
      
      if (!businessData?.user_id) {
        console.error("Business has no associated user ID");
        throw new Error("Invalid business configuration");
      }
      
      try {
        const { data: userData } = await supabase.auth.getUser();
        
        if (userData?.user?.email) {
          console.log("Found user email from current session:", userData.user.email);
          return userData.user.email;
        }
      } catch (userError) {
        console.error("Error getting user data:", userError);
      }
      
      const { data: profileData } = await supabase
        .from('business_profiles')
        .select('user_email')
        .eq('id', businessId)
        .single();
      
      if (profileData?.user_email && profileData.user_email.includes('@')) {
        console.log("Using user_email from business profile:", profileData.user_email);
        return profileData.user_email;
      }
      
      console.warn("No valid email found for business, using fallback");
      return "info@smartbookly.com";
    } catch (error) {
      console.error("Error retrieving business email:", error);
      return "info@smartbookly.com";
    }
  };

  const sendBookingNotification = async (businessEmail: string, name: string, bookingDate: Date, endDateTime: Date) => {
    try {
      console.log("🔍 Preparing to send notification email to:", businessEmail);
      
      const formattedStartDate = format(bookingDate, "MMMM dd, yyyy 'at' h:mm a");
      const formattedEndDate = format(endDateTime, "MMMM dd, yyyy 'at' h:mm a");
      console.log("🔍 Formatted dates for notification:", formattedStartDate, formattedEndDate);
      
      const notificationData = {
        businessEmail: businessEmail.trim(),
        requesterName: name,
        requestDate: formattedStartDate,
        endDate: formattedEndDate,
        phoneNumber: phone || undefined,
        notes: notes || undefined,
        requesterEmail: email || undefined
      };
      
      console.log("🔍 Sending notification with data:", JSON.stringify(notificationData));
      console.log("📤 About to send booking notification POST request");
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      const fetchPromise = fetch(
        "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(notificationData)
        }
      );
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      console.log(`🔍 Notification response status: ${response.status}`);
      
      const responseText = await response.text();
      console.log(`🔍 Notification response body: ${responseText}`);
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log("��� Parsed notification response:", responseData);
      } catch (parseError) {
        console.error("⚠️ Failed to parse notification response:", parseError);
        responseData = { 
          success: false, 
          error: "Invalid response format",
          rawResponse: responseText
        };
      }
      
      if (!response.ok) {
        console.error("❌ HTTP error sending notification:", response.status, responseText);
        throw new Error(`HTTP error ${response.status}: ${responseText || 'No response body'}`);
      }
      
      if (!responseData.success) {
        console.error("❌ Email notification failed:", responseData);
        throw new Error(responseData.error || `Failed to send notification`);
      }
      
      console.log("✅ Email notification sent successfully:", responseData);
      return { success: true, data: responseData };
    } catch (error) {
      console.error("❌ Error sending booking notification:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error sending notification" 
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || rateLimitExceeded) {
      console.log("⚠️ Submission blocked - already submitting or rate limited");
      return;
    }
    
    let hasErrors = false;
    
    if (!fullName) {
      toast({
        title: t("common.error"),
        description: "Please enter your full name",
        variant: "destructive",
      });
      console.log("⚠️ Validation error - missing full name");
      hasErrors = true;
    }
    
    if (!startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: "Please select start and end times",
        variant: "destructive",
      });
      console.log("⚠️ Validation error - missing start/end times");
      hasErrors = true;
    }
    
    if (hasErrors) {
      console.log("⚠️ Form has validation errors - stopping submission");
      return;
    }
    
    setIsSubmitting(true);
    console.log("🔍 Starting booking submission process");
    
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
          
          console.log(`⚠️ Rate limit reached, must wait ${remainingTime}`);
          setIsSubmitting(false);
          return;
        }
      }
      
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      
      console.log(`🔍 Creating booking request for business: ${businessId}`);
      console.log(`🔍 Start date: ${startDateTime.toISOString()}, End date: ${endDateTime.toISOString()}`);
      
      let parsedPaymentAmount = null;
      if (showPaymentAmount && paymentAmount) {
        parsedPaymentAmount = parseFloat(paymentAmount);
        if (isNaN(parsedPaymentAmount)) {
          parsedPaymentAmount = null;
        }
      }

      // Log the payment data for debugging
      console.log("Submitting booking request with payment data:", {
        status: paymentStatus,
        amount: parsedPaymentAmount
      });

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
          status: 'pending',
          payment_status: paymentStatus,
          payment_amount: parsedPaymentAmount
        })
        .select()
        .single();
        
      if (error) {
        console.error("❌ Error creating booking request:", error);
        throw error;
      }
      
      console.log("✅ Successfully created booking request:", data);

      localStorage.setItem(`booking_last_request_${businessId}`, Date.now().toString());
      
      let emailSent = false;
      let emailError = null;
      
      try {
        const businessEmail = await getBusinessEmail(businessId);
        console.log("🔍 Retrieved business email for notification:", businessEmail);
        
        if (!businessEmail || !businessEmail.includes('@')) {
          console.error("❌ Invalid business email format:", businessEmail);
          throw new Error("Invalid business email format");
        }
        
        const notificationResult = await sendBookingNotification(
          businessEmail,
          fullName,
          startDateTime,
          endDateTime
        );
        
        if (notificationResult.success) {
          console.log("✅ Email notification sent successfully");
          emailSent = true;
        } else {
          console.error("❌ Failed to send email notification:", notificationResult.error);
          emailError = notificationResult.error;
        }
      } catch (emailErr: any) {
        console.error("❌ Error handling notification:", emailErr);
        emailError = emailErr.message || "Unknown email error";
      }
      
      if (selectedFile && data) {
        try {
          console.log("🔍 Processing file upload for booking request ID:", data.id);
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `booking_${data.id}_${Date.now()}.${fileExt}`;
          
          console.log("🔍 Upload path:", filePath);
          
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, selectedFile);
            
          if (uploadError) {
            console.error('❌ Error uploading file:', uploadError);
          } else {
            console.log("✅ File uploaded successfully:", filePath);
            const { error: fileError } = await supabase
              .from('event_files')
              .insert({
                event_id: data.id,
                filename: selectedFile.name,
                file_path: filePath,
                content_type: selectedFile.type,
                size: selectedFile.size,
                // Use the authenticated user ID if available, otherwise leave as null
                user_id: user?.id || null
              });
              
            if (fileError) {
              console.error('❌ Error saving file metadata:', fileError);
            } else {
              console.log("✅ File metadata saved successfully for booking ID:", data.id);
            }
          }
        } catch (fileError) {
          console.error("❌ Error processing file upload:", fileError);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['business-bookings'] });
      
      if (emailSent) {
        toast({
          title: t("common.success"),
          description: t("booking.requestSubmitted"),
        });
      } else {
        toast({
          title: t("common.success"),
          description: "Your booking request has been submitted, but the notification email could not be sent. The business will still see your request on their dashboard.",
          variant: "default",
        });
        
        console.warn(`⚠️ Booking created but email failed: ${emailError}`);
      }
      
      setFullName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setSelectedFile(null);
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      
      if (onSuccess) {
        onSuccess();
      }
      
      setRateLimitExceeded(true);
      setTimeRemaining(120);
      
      console.log("✅ Booking submission process completed successfully");
    } catch (error: any) {
      console.error('❌ Error submitting booking request:', error);
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
        <Label htmlFor="paymentStatus">{t("events.paymentStatus")}</Label>
        <Select
          value={paymentStatus}
          onValueChange={(value) => setPaymentStatus(value as PaymentStatus)}
          disabled={isSubmitting || rateLimitExceeded}
        >
          <SelectTrigger id="paymentStatus" className={isGeorgian ? "font-georgian" : ""}>
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.notPaid")}</SelectItem>
            <SelectItem value="partly_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.paidPartly")}</SelectItem>
            <SelectItem value="fully_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.paidFully")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {showPaymentAmount && (
        <div className="space-y-2">
          <Label htmlFor="paymentAmount">{t("events.paymentAmount")}</Label>
          <Input
            id="paymentAmount"
            value={paymentAmount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "" || /^\d*\.?\d*$/.test(value)) {
                setPaymentAmount(value);
              }
            }}
            placeholder="0.00"
            type="text"
            inputMode="decimal"
            disabled={isSubmitting || rateLimitExceeded}
          />
        </div>
      )}
      
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
      
      <div className="flex justify-between space-x-2 pt-4">
        <div className="flex justify-end space-x-2">
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
      </div>
    </form>
  );
};
