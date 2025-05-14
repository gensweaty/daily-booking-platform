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
import { getCurrencySymbol } from '@/lib/currency';

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
  const [businessData, setBusinessData] = useState<{businessName?: string, businessEmail?: string, businessAddress?: string} | null>(null);
  
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

  // Get currency symbol based on language
  const currencySymbol = getCurrencySymbol(language);

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

  // Fetch business data early and cache it
  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const { data, error } = await supabase
          .from('business_profiles')
          .select('business_name, contact_email, contact_address')
          .eq('id', businessId)
          .single();

        if (error) {
          console.error("Error fetching business data:", error);
          return;
        }

        setBusinessData({
          businessName: data?.business_name,
          businessEmail: data?.contact_email,
          businessAddress: data?.contact_address
        });
        
        console.log("Cached business data:", data);
      } catch (err) {
        console.error("Error in business data fetch:", err);
      }
    };

    if (businessId) {
      fetchBusinessData();
    }
  }, [businessId]);

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
    setIsSubmitting(true);
    console.log("Starting form submission...");

    try {
      // Validate required fields
      if (!fullName) {
        toast.error({
          title: t("common.error"),
          description: t("events.fullNameRequired")
        });
        setIsSubmitting(false);
        return;
      }

      if (!userNumber) {
        toast.error({
          title: t("common.error"),
          description: t("events.phoneNumberRequired")
        });
        setIsSubmitting(false);
        return;
      }

      if (!socialNetworkLink || !socialNetworkLink.includes('@')) {
        toast.error({
          title: t("common.error"),
          description: t("events.validEmailRequired")
        });
        setIsSubmitting(false);
        return;
      }

      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);

      // Additional validation for dates
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        toast.error({
          title: t("common.error"),
          description: t("events.validDatesRequired")
        });
        setIsSubmitting(false);
        return;
      }

      // Process payment amount - Parse numeric value only without currency symbol
      let finalPaymentAmount = null;
      if (showPaymentAmount && paymentAmount) {
        // Remove any currency symbols or non-numeric characters except decimal point
        const cleanedAmount = paymentAmount.replace(/[^\d.]/g, '');
        const amount = parseFloat(cleanedAmount);
        if (!isNaN(amount)) {
          finalPaymentAmount = amount;
        }
      }

      // Create booking data object
      const bookingData = {
        business_id: businessId,
        requester_name: fullName,
        requester_email: socialNetworkLink,
        requester_phone: userNumber,
        title: `${fullName}`,
        description: eventNotes || null,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        payment_status: paymentStatus,
        payment_amount: finalPaymentAmount,
        status: 'pending',
        language: language // Include the current language
      };

      console.log('Submitting booking request:', bookingData);

      // Step 1: Create booking request in database
      const { data: bookingResponse, error: bookingError } = await supabase
        .from('booking_requests')
        .insert(bookingData)
        .select()
        .single();

      if (bookingError) {
        console.error('Error submitting booking request:', bookingError);
        throw bookingError;
      }

      const bookingId = bookingResponse.id;
      console.log('Booking request created with ID:', bookingId);

      // Flag to track if we need to upload a file
      let hasFile = !!selectedFile;

      // Step 2: Start email notification in parallel to file upload
      // We'll use Promise.all to run these operations in parallel
      
      // Prepare file upload promise if a file is selected
      const fileUploadPromise = selectedFile && bookingId ? (async () => {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${bookingId}/${Date.now()}.${fileExt}`;

          console.log('Uploading file to path:', filePath);
          const { error: uploadError } = await supabase.storage
            .from('booking_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            return { success: false, error: uploadError };
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
            return { success: false, error: fileRecordError };
          }
          
          console.log('File record created successfully in event_files');
          return { success: true };
        } catch (fileError) {
          console.error('Error handling file upload:', fileError);
          return { success: false, error: fileError };
        }
      })() : Promise.resolve({ success: true });

      // Prepare email notification promise
      const emailNotificationPromise = (async () => {
        try {
          console.log('Sending notification email...');
          
          // Use cached business data instead of fetching again
          const businessNameToUse = businessData?.businessName || "Business";
          
          // Prepare notification data with the business email if we have it
          const notificationData = {
            businessId: businessId,
            businessEmail: businessData?.businessEmail, // Use cached email if available
            requesterName: fullName,
            requesterEmail: socialNetworkLink,
            requesterPhone: userNumber,
            notes: eventNotes || "No additional notes",
            startDate: startDateTime.toISOString(),
            endDate: endDateTime.toISOString(),
            hasAttachment: hasFile,
            paymentStatus: paymentStatus,
            paymentAmount: finalPaymentAmount,
            businessName: businessNameToUse,
            businessAddress: businessData?.businessAddress,
            language: language // Include the current language
          };
          
          // Log notification data
          console.log("Sending email notification with data:", JSON.stringify(notificationData));
          
          // Use the full function URL with a timeout to prevent long waits
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          try {
            const response = await fetch(
              "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(notificationData),
                signal: controller.signal
              }
            );
            
            clearTimeout(timeoutId);
            console.log("Email notification response status:", response.status);
            
            return { success: true };
          } catch (fetchError) {
            clearTimeout(timeoutId);
            console.warn("Email notification request error (continuing anyway):", fetchError);
            return { success: false, error: fetchError };
          }
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          return { success: false, error: emailError };
        }
      })();

      // Start both operations in parallel but don't wait for them to complete
      Promise.all([fileUploadPromise, emailNotificationPromise])
        .then(results => {
          console.log("Background operations completed:", results);
        })
        .catch(error => {
          console.error("Error in background operations:", error);
        });

      // Show success message immediately after booking creation
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

      // Use the dedicated toast helper for booking submissions
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
      toast.error({
        title: t("common.error"),
        description: t("common.errorOccurred")
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
        
        {/* Payment Amount Field - conditionally visible with currency symbol */}
        {showPaymentAmount && (
          <div>
            <Label htmlFor="paymentAmount" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="medium">გადახდის ოდენობა</GeorgianAuthText>
              ) : (
                t("events.paymentAmount")
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                {currencySymbol}
              </span>
              <Input
                id="paymentAmount"
                value={paymentAmount.replace(/^[^0-9.]*/, '')} // Remove any non-numeric prefix (like currency symbol) when displaying
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow only numbers and decimal point
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setPaymentAmount(value);
                  }
                }}
                placeholder="0.00"
                type="text"
                inputMode="decimal"
                className={cn(isGeorgian ? "font-georgian" : "", "pl-7")} // Added left padding to make room for currency symbol
                style={georgianFontStyle}
                aria-label={`${t("events.paymentAmount")} (${currencySymbol})`}
              />
            </div>
          </div>
        )}
        
        {/* Notes Field */}
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
        
        {/* File Upload Field */}
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
