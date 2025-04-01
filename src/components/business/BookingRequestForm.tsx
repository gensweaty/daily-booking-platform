
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createBookingRequest } from "@/lib/api";
import { format } from "date-fns";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookingRequestFormProps {
  businessId: string;
  selectedDate: Date;
  startTime: string;
  endTime: string;
  onSuccess: () => void;
}

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  startTime,
  endTime,
  onSuccess,
}: BookingRequestFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date(selectedDate);
    const [hours, minutes] = startTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return format(date, "yyyy-MM-dd'T'HH:mm");
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date(selectedDate);
    const [hours, minutes] = endTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return format(date, "yyyy-MM-dd'T'HH:mm");
  });
  const { user } = useAuth();
  const { t } = useLanguage();

  const formatDateWithTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Format dates
      const startDateTime = formatDateWithTime(startDate);
      const endDateTime = formatDateWithTime(endDate);
      
      // Check for time slot conflicts
      const { data: conflictingEvents } = await supabase
        .from('events')
        .select('id, title, start_date, end_date')
        .filter('start_date', 'lt', endDateTime)
        .filter('end_date', 'gt', startDateTime);
      
      const { data: conflictingBookings } = await supabase
        .from('booking_requests')
        .select('id, title, start_date, end_date, status')
        .eq('status', 'approved')
        .filter('start_date', 'lt', endDateTime)
        .filter('end_date', 'gt', startDateTime);
      
      if ((conflictingEvents && conflictingEvents.length > 0) || 
          (conflictingBookings && conflictingBookings.length > 0)) {
        toast({
          title: "Time Slot Unavailable",
          description: "This time slot is already booked. Please select a different time.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Create booking request
      const bookingRequest = await createBookingRequest({
        business_id: businessId,
        title: title,
        requester_name: title, // Using title (full name) as requester_name for consistency
        requester_email: socialNetworkLink, // Using socialNetworkLink as email/contact
        requester_phone: userNumber,
        start_date: startDateTime,
        end_date: endDateTime,
        description: eventNotes,
        // Additional fields that match the EventDialog structure
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined
      });

      // Handle file upload if a file is selected
      if (selectedFile && bookingRequest?.id) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          toast({
            title: "File Upload Error",
            description: "Your booking was created but the file couldn't be uploaded.",
            variant: "destructive",
          });
        } else {
          // Create file record
          const { error: fileRecordError } = await supabase
            .from('booking_files')
            .insert({
              booking_id: bookingRequest.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size,
              user_id: user?.id || null
            });

          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
          }
        }
      }

      toast({
        title: "Booking Request Submitted",
        description: "Your booking request has been submitted successfully and is pending approval.",
      });
      
      onSuccess();
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit booking request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-1">
      <h2 className="text-xl font-bold mb-4">{t("events.addNewEvent")}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        For {format(selectedDate, "EEEE, MMMM d, yyyy")} from {startTime} to {endTime}
      </p>
      
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t("events.fullNameRequired")}</Label>
          <Input
            id="title"
            placeholder={t("events.fullName")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="number">{t("events.phoneNumber")}</Label>
          <Input
            id="number"
            type="tel"
            placeholder={t("events.phoneNumber")}
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="socialNetwork">{t("events.socialLinkEmail")}</Label>
          <Input
            id="socialNetwork"
            type="text"
            placeholder={t("events.socialLinkEmail")}
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("events.dateAndTime")}</Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate" className="text-sm text-muted-foreground mb-1">
                {t("events.startDateTime")}
              </Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-sm text-muted-foreground mb-1">
                {t("events.endDateTime")}
              </Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("events.paymentStatus")}</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={t("crm.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
              <SelectItem value="partly">{t("crm.paidPartly")}</SelectItem>
              <SelectItem value="fully">{t("crm.paidFully")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("events.paymentStatusNote")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t("events.eventNotes")}</Label>
          <Textarea
            id="notes"
            placeholder={t("events.addEventNotes")}
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="file">{t("events.attachment")}</Label>
          <FileUploadField 
            onFileChange={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isSubmitting}
        >
          {isSubmitting ? t("common.submitting") : t("events.submitBookingRequest")}
        </Button>
      </form>
    </div>
  );
};
