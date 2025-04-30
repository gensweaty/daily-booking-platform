
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingRequestFormProps {
  businessId: string;
  selectedSlot: {
    start: Date;
    end: Date;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated: () => void;
}

export const BookingRequestForm = ({
  businessId,
  selectedSlot,
  isOpen,
  onClose,
  onBookingCreated,
}: BookingRequestFormProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isGeorgian = language === 'ka';

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    if (selectedSlot) {
      const formattedStart = format(selectedSlot.start, "yyyy-MM-dd'T'HH:mm");
      const formattedEnd = format(selectedSlot.end, "yyyy-MM-dd'T'HH:mm");
      setStartDate(formattedStart);
      setEndDate(formattedEnd);
    }
  }, [selectedSlot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || !email) {
      toast({
        title: t("common.error"),
        description: t("business.fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      
      // Create booking request in the database
      const { data: bookingData, error: bookingError } = await supabase
        .from("booking_requests")
        .insert({
          business_id: businessId,
          title: fullName,
          requester_name: fullName,
          requester_email: email,
          requester_phone: phone,
          description: notes,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          status: "pending",
          payment_status: paymentStatus
        })
        .select("id")
        .single();
      
      if (bookingError) {
        throw bookingError;
      }
      
      // If there's a selected file, upload it
      if (selectedFile && bookingData?.id) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${bookingData.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        
        const { error: uploadError } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);
        
        if (uploadError) {
          console.error('Error uploading file:', uploadError);
        } else {
          // Create file record in booking_files table
          const { error: fileRecordError } = await supabase
            .from('booking_files')
            .insert({
              booking_request_id: bookingData.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size,
            });
          
          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
          }
        }
      }
      
      // Send notification to business owner
      const { error: functionError } = await supabase.functions.invoke(
        "send-booking-request-notification",
        {
          body: {
            businessId,
            requesterName: fullName,
            requesterEmail: email,
            requestStartTime: new Date(startDate).toISOString(),
            requestEndTime: new Date(endDate).toISOString(),
          },
        }
      );
      
      if (functionError) {
        console.error("Error sending notification:", functionError);
      }
      
      toast({
        title: t("business.bookingRequestSent"),
        description: t("business.bookingRequestConfirmation"),
      });
      
      // Reset form
      setFullName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setSelectedFile(null);
      
      onClose();
      onBookingCreated();
      
    } catch (error: any) {
      console.error('Booking request error:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("business.bookingRequestError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg w-full">
        <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
          {t("business.bookAppointment")}
        </DialogTitle>
        
        {selectedSlot && (
          <div className="text-muted-foreground mb-4">
            {format(selectedSlot.start, "EEEE, MMMM d, yyyy")}
            <br />
            {format(selectedSlot.start, "HH:mm")} - {format(selectedSlot.end, "HH:mm")}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className={isGeorgian ? "font-georgian" : ""}>
              {t("events.fullName")}
            </Label>
            <Input
              id="fullName"
              placeholder={t("events.fullName")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone" className={isGeorgian ? "font-georgian" : ""}>
              {t("events.phoneNumber")}
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t("events.phoneNumber")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className={isGeorgian ? "font-georgian" : ""}>
              {t("events.socialLinkEmail")}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dateTime" className={isGeorgian ? "font-georgian" : ""}>
              {t("events.dateAndTime")}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                  {t("events.start")}
                </Label>
                <div className="relative">
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="pr-8"
                  />
                  <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                  {t("events.end")}
                </Label>
                <div className="relative">
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="pr-8"
                  />
                  <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="paymentStatus" className={isGeorgian ? "font-georgian" : ""}>
              {t("events.paymentStatus")}
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
          
          <div className="space-y-2">
            <Label htmlFor="notes" className={isGeorgian ? "font-georgian" : ""}>
              {t("events.eventNotes")}
            </Label>
            <Textarea
              id="notes"
              placeholder={t("events.addEventNotes")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
          
          <div className="space-y-2">
            <Label className={isGeorgian ? "font-georgian" : ""}>
              {t("common.attachments")}
            </Label>
            <FileUploadField
              onChange={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              acceptedFileTypes=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
              selectedFile={selectedFile}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? t("common.submitting") : t("business.submitRequest")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingRequestForm;
