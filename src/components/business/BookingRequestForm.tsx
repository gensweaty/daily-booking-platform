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
import { Asterisk } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      console.log("Starting form submission...");

      // Validate required fields
      if (!fullName) {
        toast({
          title: t('common.error'),
          description: t('Name is required'),
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }

      if (!userNumber) {
        toast({
          title: t('common.error'),
          description: t('Phone number is required'),
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }

      if (!socialNetworkLink || !socialNetworkLink.includes('@')) {
        toast({
          title: t('common.error'),
          description: t('Valid email address is required'),
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }

      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);

      // Additional validation for dates
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        toast({
          title: t('common.error'),
          description: t('Valid start and end dates are required'),
          variant: 'destructive'
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

      // First fetch business information including the email
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('business_name, user_id')
        .eq('id', businessId)
        .single();

      if (businessError) {
        console.error('Error fetching business data:', businessError);
      }

      // Get the user's email from the auth.users table using the user_id from business_profiles
      let businessEmail = null;
      let businessName = businessData?.business_name || null;

      if (businessData?.user_id) {
        // First try to get email from profiles table
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', businessData.user_id)
          .single();
          
        if (userError) {
          console.error('Error fetching user email from profiles:', userError);
        } else if (userData && userData.email) {
          businessEmail = userData.email;
          console.log("Retrieved business email from profiles:", businessEmail);
        }
      }

      console.log('Fetched business data:', {
        businessEmail,
        businessName,
        businessId
      });

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
      
      // Reset form and show success toast
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
        console.log('Sending notification email...');
        console.log('Business email to notify:', businessEmail);
        
        // Make sure we have all the data needed for the notification
        if (!businessEmail) {
          // If we couldn't get the email from profiles, try directly from auth.users via RPC
          const { data: authUser, error: rpcError } = await supabase.rpc('get_business_owner_email', {
            business_id_param: businessId
          });
          
          if (rpcError) {
            console.error("Error getting business owner email via RPC:", rpcError);
          } else if (authUser && authUser.length > 0) {
            businessEmail = authUser[0].email;
            console.log("Retrieved business email via RPC:", businessEmail);
          } else {
            console.error("No email found via RPC function");
          }
          
          // If still no email, try one more approach - get directly from auth.users if we have a session
          if (!businessEmail && businessData?.user_id) {
            // This is a last resort and may not work due to RLS policies
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session) {
              // Try to get user data if the current user is an admin or the business owner
              const { data: authUserData } = await supabase.auth.admin.getUserById(businessData.user_id);
              if (authUserData?.user?.email) {
                businessEmail = authUserData.user.email;
                console.log("Retrieved business email via admin API:", businessEmail);
              }
            }
          }
          
          if (!businessEmail) {
            console.error("Could not retrieve business email through any method");
            toast({
              title: t('common.error'),
              description: t('Could not send notification to business owner. Your booking is still submitted.'),
              variant: 'destructive'
            });
          }
        }
        
        // Prepare notification data with all required fields
        const notificationData = {
          businessEmail: businessEmail,
          businessName: businessName || "",
          requesterName: fullName,
          requesterEmail: socialNetworkLink,
          requestDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          phoneNumber: userNumber,
          notes: eventNotes || "",
          language: language
        };
        
        console.log("Notification data:", notificationData);
        
        if (!businessEmail) {
          console.error("Missing business email, cannot send notification");
          return; // Skip sending if no email available
        }
        
        const response = await fetch(
          "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(notificationData),
          }
        );

        const responseData = await response.text();
        console.log(`Email notification response (${response.status}):`, responseData);
        
        if (!response.ok) {
          console.error("Email notification failed:", responseData);
          toast({
            title: t('common.warning'),
            description: t('Your booking was submitted, but the notification email failed to send.'),
            variant: 'default'
          });
        } else {
          console.log("Email notification sent to business owner");
        }
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        toast({
          title: t('common.warning'),
          description: t('Your booking was submitted, but we could not notify the business owner.'),
          variant: 'default'
        });
      }
      
      setIsSubmitting(false);
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
        <LanguageText withFont={true} fixLetterSpacing={true}>
          {t('booking.bookAppointment')}
        </LanguageText>
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        {/* Full Name Field */}
        <div>
          <Label htmlFor="fullName" className={labelClass}>
            <LanguageText>{t("events.fullName")}</LanguageText>
            <RequiredFieldIndicator />
          </Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={handleNameChange}
            placeholder={t("events.fullName")}
            required
          />
        </div>

        {/* Phone Number Field */}
        <div>
          <Label htmlFor="userNumber" className={labelClass}>
            <LanguageText>{t("events.phoneNumber")}</LanguageText>
            <RequiredFieldIndicator />
          </Label>
          <Input
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            placeholder={t("events.phoneNumber")}
            required
          />
        </div>

        {/* Email Field */}
        <div>
          <Label htmlFor="socialNetworkLink" className={labelClass}>
            <LanguageText>{t("events.socialLinkEmail")}</LanguageText>
            <RequiredFieldIndicator />
          </Label>
          <Input
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder="email@example.com"
            type="email"
            required
          />
        </div>

        {/* Date and Time Fields */}
        <div>
          <Label htmlFor="dateTime" className={labelClass}>
            <LanguageText>{t("events.dateAndTime")}</LanguageText>
            <RequiredFieldIndicator />
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                <LanguageText>{t("events.start")}</LanguageText>
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
              <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                <LanguageText>{t("events.end")}</LanguageText>
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
          <Label htmlFor="paymentStatus" className={labelClass}>
            <LanguageText>{t("events.paymentStatus")}</LanguageText>
          </Label>
          <Select
            value={paymentStatus}
            onValueChange={setPaymentStatus}
          >
            <SelectTrigger id="paymentStatus" className={isGeorgian ? "font-georgian" : ""}>
              <SelectValue placeholder={t("events.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="not_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.notPaid")}</SelectItem>
              <SelectItem value="partly_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.paidPartly")}</SelectItem>
              <SelectItem value="fully_paid" className={isGeorgian ? "font-georgian" : ""}>{t("crm.paidFully")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Payment Amount Field - conditionally visible */}
        {showPaymentAmount && (
          <div>
            <Label htmlFor="paymentAmount" className={labelClass}>
              <LanguageText>{t("events.paymentAmount")}</LanguageText>
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
            />
          </div>
        )}
        
        {/* Notes Field */}
        <div>
          <Label htmlFor="eventNotes" className={labelClass}>
            <LanguageText>{t("events.eventNotes")}</LanguageText>
          </Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            placeholder={t("events.addEventNotes")}
            className="min-h-[100px] resize-none"
          />
        </div>
        
        {/* File Upload Field - Fix label duplication */}
        <div>
          <Label htmlFor="file" className={labelClass}>
            <LanguageText>{t("common.attachments")}</LanguageText>
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
          <LanguageText withFont={true} fixLetterSpacing={true}>
            {isSubmitting ? t('common.submitting') : t('events.submitRequest')}
          </LanguageText>
        </Button>
      </form>
    </div>
  );
};

export default BookingRequestForm;
