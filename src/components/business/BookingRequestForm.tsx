import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import { Asterisk } from 'lucide-react';
import { getGeorgianFontStyle } from '@/lib/font-utils';

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
  const isGeorgian = language === 'ka';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Replace useState with fullName state
  const [fullName, setFullName] = useState('');
  
  // Add new state variables to match EventDialog structure
  const [userSurname, setUserSurname] = useState('');
  const [userNumber, setUserNumber] = useState('');
  const [socialNetworkLink, setSocialNetworkLink] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('not_paid');
  const [paymentAmount, setPaymentAmount] = useState('');

  // Move date initialization to useEffect
  useEffect(() => {
    try {
      const start = combineDateAndTime(selectedDate, startTime);
      const end = combineDateAndTime(selectedDate, endTime);
      
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    } catch (error) {
      console.error('Error initializing dates:', error);
      // Set fallback dates in case of error
      const now = new Date();
      const oneHourLater = new Date(now);
      oneHourLater.setHours(oneHourLater.getHours() + 1);
      
      setStartDate(format(now, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(oneHourLater, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [selectedDate, startTime, endTime]);

  // Common Georgian font styling for consistent rendering
  const georgianFontStyle = isGeorgian ? getGeorgianFontStyle() : undefined;
  
  const labelClass = cn("block font-medium", isGeorgian ? "font-georgian" : "");
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";

  // Create a required field indicator component
  const RequiredFieldIndicator = () => (
    <Asterisk className="inline h-3 w-3 text-destructive ml-1" />
  );

  const combineDateAndTime = (date: Date, timeString: string) => {
    if (!timeString) return new Date(date);
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  };

  // Handle name change to update both fullName and userSurname
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFullName(value);
    setUserSurname(value);
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setFileError('');
  };

  // Helper function for Georgian text to ensure consistent rendering
  const renderGeorgianText = (text: string) => {
    if (!isGeorgian) return text;
    
    return (
      <span 
        className="font-georgian georgian-text-fix"
        style={georgianFontStyle}
      >
        {text}
      </span>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      console.log("Starting form submission...");

      // Validate required fields
      if (!fullName) {
        toast({
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "events.fullNameRequired"
          }
        });
        setIsSubmitting(false);
        return;
      }

      if (!userNumber) {
        toast({
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "events.phoneNumberRequired"
          }
        });
        setIsSubmitting(false);
        return;
      }

      if (!socialNetworkLink || !socialNetworkLink.includes('@')) {
        toast({
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "events.validEmailRequired"
          }
        });
        setIsSubmitting(false);
        return;
      }

      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);

      // Additional validation for dates
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        toast({
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "events.validDatesRequired"
          }
        });
        setIsSubmitting(false);
        return;
      }

      // Process payment amount
      let finalPaymentAmount = null;
      if (showPaymentAmount && paymentAmount) {
        const amount = parseFloat(paymentAmount);
        if (!isNaN(amount)) {
          finalPaymentAmount = amount;
        }
      }

      // First, fetch the business owner's email using the RPC function to ensure we have it
      let businessEmail = null;
      try {
        console.log("Fetching business owner email for ID:", businessId);
        
        // Call the RPC function directly to get the email
        const { data: emailData, error: emailError } = await supabase
          .rpc('get_business_owner_email', { business_id_param: businessId });
          
        if (emailError) {
          console.error("Error getting business email via RPC:", emailError);
          
          // Fallback: Query business_profiles and auth.users directly
          const { data: businessData } = await supabase
            .from('business_profiles')
            .select('user_id')
            .eq('id', businessId)
            .single();
            
          if (businessData && businessData.user_id) {
            const { data: userData } = await supabase.auth.admin.getUserById(businessData.user_id);
            if (userData && userData.user && userData.user.email) {
              businessEmail = userData.user.email;
              console.log("Retrieved business email via user lookup:", businessEmail);
            }
          }
        } else if (emailData && emailData.email) {
          businessEmail = emailData.email;
          console.log("Retrieved business email via RPC:", businessEmail);
        }
      } catch (emailLookupError) {
        console.error("Failed to retrieve business email:", emailLookupError);
      }

      const bookingData = {
        business_id: businessId,
        requester_name: fullName,
        requester_email: socialNetworkLink,
        requester_phone: userNumber,
        // Use fullName for both title and requester_name to ensure consistency
        title: `${fullName}`,
        description: eventNotes || null,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        payment_status: paymentStatus,
        payment_amount: finalPaymentAmount,
        status: 'pending',
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
      console.log('Booking request created with ID:', bookingId);

      // Track if file was uploaded for notification purposes
      let fileUploaded = false;

      if (selectedFile && bookingId) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${bookingId}/${Date.now()}.${fileExt}`;

          console.log('Uploading file to path:', filePath);
          const { error: uploadError } = await supabase.storage
            .from('booking_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }

          console.log('File uploaded successfully to path:', filePath);
          fileUploaded = true;

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
      
      try {
        console.log('Sending notification email...');
        
        // Get a business name if possible
        let businessNameToUse = "Business";
        
        try {
          const { data: businessData } = await supabase
            .from('business_profiles')
            .select('business_name')
            .eq('id', businessId)
            .single();
            
          if (businessData && businessData.business_name) {
            businessNameToUse = businessData.business_name;
            console.log("Using business name:", businessNameToUse);
          }
        } catch (err) {
          console.warn("Could not get business name:", err);
        }
        
        // Prepare notification data with the business email if we have it
        const notificationData = {
          businessId: businessId,
          businessEmail: businessEmail, // Include the email if we have it
          requesterName: fullName,
          requesterEmail: socialNetworkLink,
          requesterPhone: userNumber,
          notes: eventNotes || "No additional notes",
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          hasAttachment: fileUploaded,
          paymentStatus: paymentStatus,
          paymentAmount: finalPaymentAmount,
          businessName: businessNameToUse
        };
        
        // Log notification data
        console.log("Sending email notification with data:", JSON.stringify(notificationData));
        
        // Use the full function URL
        const response = await fetch(
          "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(notificationData),
          }
        );
        
        console.log("Email notification response status:", response.status);
        
        const responseData = await response.text();
        try {
          const parsedResponse = JSON.parse(responseData);
          console.log("Email notification response:", parsedResponse);
        } catch (e) {
          console.log("Raw email notification response:", responseData);
        }
        
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
      }
      
      setIsSubmitting(false);
      
      // Reset form
      setFullName('');
      setUserSurname('');
      setUserNumber('');
      setSocialNetworkLink('');
      setEventNotes('');
      setPaymentStatus('not_paid');
      setPaymentAmount('');
      setSelectedFile(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Use the dedicated toast helper for booking submissions instead of direct toast call
      toast.event.bookingSubmitted();

      if (onSuccess) {
        onSuccess();
      }

      if (onOpenChange) {
        onOpenChange(false);
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      setIsSubmitting(false);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
    }
  };

  // Get the correct Georgian placeholder text for event notes
  const getEventNotesPlaceholder = () => {
    if (isGeorgian) {
      return "დაამატეთ შენიშვნები თქვენი მოთხოვნის შესახებ";
    }
    return t("events.addEventNotes");
  };

  return (
    <div className="space-y-4 p-1">
      <h3 className="text-xl font-semibold">
        {isGeorgian ? (
          <GeorgianAuthText fontWeight="semibold">
            მოთხოვნის გაგზავნა
          </GeorgianAuthText>
        ) : (
          <LanguageText>
            {t('booking.bookAppointment')}
          </LanguageText>
        )}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        {/* Full Name Field */}
        <div>
          <Label htmlFor="fullName" className={labelClass} style={georgianFontStyle}>
            {isGeorgian ? (
              <>
                <GeorgianAuthText fontWeight="medium">სრული სახელი</GeorgianAuthText>
                <RequiredFieldIndicator />
              </>
            ) : (
              <>
                {t("events.fullName")}
                <RequiredFieldIndicator />
              </>
            )}
          </Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={handleNameChange}
            placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")}
            required
            className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
            style={georgianFontStyle}
          />
        </div>

        {/* Phone Number Field */}
        <div>
          <Label htmlFor="userNumber" className={labelClass} style={georgianFontStyle}>
            {isGeorgian ? (
              <>
                <GeorgianAuthText fontWeight="medium">ტელეფონის ნომერი</GeorgianAuthText>
                <RequiredFieldIndicator />
              </>
            ) : (
              <>
                {t("events.phoneNumber")}
                <RequiredFieldIndicator />
              </>
            )}
          </Label>
          <Input
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
            required
            className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
            style={georgianFontStyle}
          />
        </div>

        {/* Email Field */}
        <div>
          <Label htmlFor="socialNetworkLink" className={labelClass} style={georgianFontStyle}>
            {isGeorgian ? (
              <>
                <GeorgianAuthText fontWeight="medium">ელფოსტა / სოციალური ქსელის ბმული</GeorgianAuthText>
                <RequiredFieldIndicator />
              </>
            ) : (
              <>
                {t("events.socialLinkEmail")}
                <RequiredFieldIndicator />
              </>
            )}
          </Label>
          <Input
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder="email@example.com"
            type="email"
            required
            style={georgianFontStyle}
          />
        </div>

        {/* Date and Time Fields */}
        <div>
          <Label htmlFor="dateTime" className={labelClass} style={georgianFontStyle}>
            {isGeorgian ? (
              <>
                <GeorgianAuthText fontWeight="medium">თარიღი და დრო</GeorgianAuthText>
                <RequiredFieldIndicator />
              </>
            ) : (
              <>
                {t("events.dateAndTime")}
                <RequiredFieldIndicator />
              </>
            )}
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianFontStyle}>
                {isGeorgian ? (
                  <GeorgianAuthText>დაწყება</GeorgianAuthText>
                ) : (
                  t("events.start")
                )}
              </Label>
              <div className="relative">
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full"
                  style={{ colorScheme: 'auto' }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianFontStyle}>
                {isGeorgian ? (
                  <GeorgianAuthText>დასრულება</GeorgianAuthText>
                ) : (
                  t("events.end")
                )}
              </Label>
              <div className="relative">
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full"
                  style={{ colorScheme: 'auto' }}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Payment Status Dropdown */}
        <div>
          <Label htmlFor="paymentStatus" className={labelClass} style={georgianFontStyle}>
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="medium">გადახდის სტატუსი</GeorgianAuthText>
            ) : (
              t("events.paymentStatus")
            )}
          </Label>
          <Select
            value={paymentStatus}
            onValueChange={setPaymentStatus}
          >
            <SelectTrigger id="paymentStatus" className={isGeorgian ? "font-georgian" : ""} style={georgianFontStyle}>
              <SelectValue placeholder={isGeorgian ? "აირჩიეთ გადახდის სტატუსი" : t("events.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent className={`bg-background ${isGeorgian ? "font-georgian" : ""}`}>
              <SelectItem value="not_paid" className={isGeorgian ? "font-georgian" : ""} style={georgianFontStyle}>
                {isGeorgian ? "გადაუხდელი" : t("crm.notPaid")}
              </SelectItem>
              <SelectItem value="partly_paid" className={isGeorgian ? "font-georgian" : ""} style={georgianFontStyle}>
                {isGeorgian ? "ნაწილობრივ გადახდილი" : t("crm.paidPartly")}
              </SelectItem>
              <SelectItem value="fully_paid" className={isGeorgian ? "font-georgian" : ""} style={georgianFontStyle}>
                {isGeorgian ? "სრულად გადახდილი" : t("crm.paidFully")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Payment Amount Field - conditionally visible */}
        {showPaymentAmount && (
          <div>
            <Label htmlFor="paymentAmount" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="medium">გადახდის ოდენობა</GeorgianAuthText>
              ) : (
                t("events.paymentAmount")
              )}
            </Label>
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
              className={isGeorgian ? "font-georgian" : ""}
              style={georgianFontStyle}
            />
          </div>
        )}
        
        {/* Notes Field - UPDATE THIS SECTION */}
        <div>
          <Label htmlFor="eventNotes" className={labelClass} style={georgianFontStyle}>
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="medium">შენიშვნები</GeorgianAuthText>
            ) : (
              t("events.eventNotes")
            )}
          </Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            placeholder={getEventNotesPlaceholder()}
            className={cn("min-h-[100px] resize-none", isGeorgian ? "placeholder:font-georgian font-georgian" : "")}
            style={georgianFontStyle}
          />
        </div>
        
        {/* File Upload Field - Fix label duplication */}
        <div>
          <Label htmlFor="file" className={labelClass} style={georgianFontStyle}>
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="medium">დანართები</GeorgianAuthText>
            ) : (
              t("common.attachments")
            )}
          </Label>
          <FileUploadField
            onChange={handleFileChange}
            fileError={fileError}
            setFileError={setFileError}
            selectedFile={selectedFile}
            ref={fileInputRef}
            acceptedFileTypes=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            hideLabel={true}
          />
        </div>
        
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
        >
          {isGeorgian ? (
            <GeorgianAuthText fontWeight="medium">
              {isSubmitting ? "იგზავნება..." : "მოთხოვნის გაგზავნა"}
            </GeorgianAuthText>
          ) : (
            <LanguageText>
              {isSubmitting ? t('common.submitting') : t('events.submitRequest')}
            </LanguageText>
          )}
        </Button>
      </form>
    </div>
  );
};

export default BookingRequestForm;
