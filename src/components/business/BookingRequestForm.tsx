
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { createBookingRequest } from "@/lib/api";
import { FileUploadField } from "../shared/FileUploadField";
import { supabase } from "@/lib/supabase";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BookingRequestFormProps {
  businessId: string;
  selectedDate: Date;
  startTime?: string;
  endTime?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  startTime,
  endTime,
  open,
  onOpenChange,
  onSuccess,
}: BookingRequestFormProps) => {
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [description, setDescription] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [startDate, setStartDate] = useState(format(selectedDate, "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { t, language } = useLanguage();
  const { toast } = useToast();

  // Initialize end date as current date + 1 hour
  useEffect(() => {
    if (selectedDate) {
      const start = new Date(selectedDate);
      if (startTime) {
        const [hours, minutes] = startTime.split(':').map(Number);
        start.setHours(hours || 0);
        start.setMinutes(minutes || 0);
      }

      // Calculate end time - default to 1 hour later
      const end = new Date(start);
      if (endTime) {
        const [hours, minutes] = endTime.split(':').map(Number);
        end.setHours(hours || 0);
        end.setMinutes(minutes || 0);
      } else {
        end.setHours(end.getHours() + 1);
      }

      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [selectedDate, startTime, endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!requesterName || !requesterEmail || !startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: t("bookings.fillRequiredFields"),
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // First save the booking request
      const bookingData = {
        business_id: businessId,
        requester_name: requesterName,
        requester_email: requesterEmail,
        requester_phone: requesterPhone,
        social_network_link: socialNetworkLink,
        title: requesterName, // Set title to requester's name
        description,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        start_date: startDate,
        end_date: endDate
      };

      const newBooking = await createBookingRequest(bookingData);
      console.log("Created booking request:", newBooking);

      // If there's a file, upload it
      if (selectedFile) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('booking_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            toast({
              title: t("common.error"),
              description: t("common.fileUploadError"),
              variant: "destructive"
            });
          } else {
            console.log("File uploaded successfully to path:", filePath);
            
            // Store file reference in the database
            const { error: fileRefError } = await supabase
              .from('event_files')
              .insert({
                event_id: newBooking.id,
                file_path: filePath,
                filename: selectedFile.name,
                content_type: selectedFile.type,
                size: selectedFile.size
              });

            if (fileRefError) {
              console.error('Error saving file reference:', fileRefError);
            }
          }
        } catch (fileError) {
          console.error('Exception during file upload:', fileError);
        }
      }

      toast({
        title: t("bookings.requestSubmitted"),
        description: t("bookings.requestSubmittedDesc")
      });

      if (onSuccess) {
        onSuccess();
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error creating booking request:", error);
      toast({
        title: t("common.error"),
        description: t("bookings.requestError"),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Request Booking</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Your Name *</Label>
          <Input
            id="name"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            placeholder="Your full name"
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Your Email *</Label>
          <Input
            id="email"
            type="email"
            value={requesterEmail}
            onChange={(e) => setRequesterEmail(e.target.value)}
            placeholder="your.email@example.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="phone">Your Phone</Label>
          <Input
            id="phone"
            value={requesterPhone}
            onChange={(e) => setRequesterPhone(e.target.value)}
            placeholder="Phone number"
          />
        </div>

        <div>
          <Label htmlFor="socialLink">Social Link or Email</Label>
          <Input
            id="socialLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder="Instagram, Facebook, or additional email"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date & Time *</Label>
            <div className="relative">
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <CalendarIcon className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div>
            <Label htmlFor="endDate">End Date & Time *</Label>
            <div className="relative">
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
              <CalendarIcon className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="paymentStatus">Payment Status</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger id="paymentStatus">
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">Not Paid</SelectItem>
              <SelectItem value="partly">Paid Partially</SelectItem>
              <SelectItem value="fully">Paid Fully</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-1">
            Payment status will be set after your booking is approved
          </p>
        </div>

        {(paymentStatus === 'partly' || paymentStatus === 'fully') && (
          <div>
            <Label htmlFor="paymentAmount">
              Payment Amount ({language === 'es' ? '€' : '$'})
            </Label>
            <Input
              id="paymentAmount"
              type="number"
              step="0.01"
              placeholder="Enter amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
            />
          </div>
        )}

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide any additional details about your booking"
            rows={3}
          />
        </div>

        <FileUploadField
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
          hideLabel={true}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Request"}
      </Button>
    </form>
  );
};
