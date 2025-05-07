
import { useState, FormEvent, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { format, addHours, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookingRequestFormProps {
  businessId: string;
  businessName?: string;
  selectedDate?: Date;
  startTime?: string;
  endTime?: string;
  onSuccess?: () => void;
  isExternalBooking?: boolean;
}

export function BookingRequestForm({ 
  businessId, 
  businessName = "",
  selectedDate,
  startTime,
  endTime,
  onSuccess,
  isExternalBooking = false
}: BookingRequestFormProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestFormData, setRequestFormData] = useState({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    notes: "No additional notes",
  });
  
  // Get current time rounded to nearest hour
  const roundToNearestHour = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(0, 0, 0); // Set minutes, seconds and ms to 0
    return d;
  };
  
  const now = new Date();
  
  // State for dates and times
  const [startDate, setStartDate] = useState<Date>(selectedDate || roundToNearestHour(addDays(now, 1)));
  const [endDate, setEndDate] = useState<Date>(() => {
    if (selectedDate && endTime) {
      const endDateTime = new Date(selectedDate);
      const [hours, minutes] = endTime.split(':').map(Number);
      endDateTime.setHours(hours, minutes || 0, 0, 0);
      return endDateTime;
    }
    return roundToNearestHour(addHours(addDays(now, 1), 1));
  });

  // Update dates when props change
  useEffect(() => {
    if (selectedDate) {
      // If we have a selected date and start time
      if (startTime) {
        const newStartDate = new Date(selectedDate);
        const [hours, minutes] = startTime.split(':').map(Number);
        newStartDate.setHours(hours, minutes || 0, 0, 0);
        setStartDate(newStartDate);
      } else {
        setStartDate(selectedDate);
      }

      // If we have a selected date and end time
      if (endTime) {
        const newEndDate = new Date(selectedDate);
        const [hours, minutes] = endTime.split(':').map(Number);
        newEndDate.setHours(hours, minutes || 0, 0, 0);
        setEndDate(newEndDate);
      } else {
        // Default to 1 hour after start time
        const newEndDate = new Date(startDate);
        newEndDate.setHours(startDate.getHours() + 1);
        setEndDate(newEndDate);
      }
    }
  }, [selectedDate, startTime, endTime]);
  
  // State for selected file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Validate form
      if (!requestFormData.requesterName || !requestFormData.requesterEmail) {
        toast({
          title: t("common.error"),
          description: t("common.requiredFieldsMissing"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // If end date is before start date, show error
      if (endDate < startDate) {
        toast({
          title: t("common.error"),
          description: t("common.endDateBeforeStart"), 
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Create booking request as first step
      const { data: bookingRequest, error: bookingError } = await supabase
        .from('booking_requests')
        .insert({
          business_id: businessId,
          requester_name: requestFormData.requesterName,
          requester_email: requestFormData.requesterEmail,
          requester_phone: requestFormData.requesterPhone || null,
          description: requestFormData.notes,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          title: `Booking for ${requestFormData.requesterName}`,
          payment_status: "not_paid",
        })
        .select()
        .single();
      
      if (bookingError) {
        console.error("Error creating booking request:", bookingError);
        toast({
          title: t("common.error"),
          description: bookingError.message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // If there's a file, upload it
      let fileUploaded = false;
      
      if (selectedFile && bookingRequest) {
        // Create a unique path for the file
        const timestamp = Date.now();
        const fileExtension = selectedFile.name.split('.').pop();
        const filePath = `booking_${bookingRequest.id}/${timestamp}_${selectedFile.name.replace(/\s+/g, '_')}`;
        
        // Upload the file
        const { error: uploadError } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);
          
        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          // Don't fail the whole request because of file upload issue
          // Just continue and the booking will be created without the file
        } else {
          // If upload successful, create record in booking_files table
          const { error: fileRecordError } = await supabase
            .from('booking_files')
            .insert({
              booking_request_id: bookingRequest.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size,
            });
            
          if (fileRecordError) {
            console.error("Error creating file record:", fileRecordError);
            // Don't fail the whole request because of record creation issue
          } else {
            fileUploaded = true;
          }
        }
      }
      
      // Send email notification in parallel to improve performance
      const notifyPromise = fetch(
        "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId,
            businessName,
            requesterName: requestFormData.requesterName,
            requesterEmail: requestFormData.requesterEmail,
            requesterPhone: requestFormData.requesterPhone,
            notes: requestFormData.notes,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            hasAttachment: fileUploaded,
          }),
        }
      );
      
      // Don't wait for the email notification to complete - we'll show success message once the booking is created
      // This significantly improves perceived performance
      notifyPromise.catch((error) => {
        console.error("Error sending email notification:", error);
        // We don't show this error to the user since the booking was created successfully
      });
      
      // Clear form and show success message
      setRequestFormData({
        requesterName: "",
        requesterEmail: "",
        requesterPhone: "",
        notes: "No additional notes",
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      toast({
        title: t("bookings.requestSubmitted"),
        description: t("bookings.requestSubmittedDetails"),
      });
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting booking request:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("common.errorOccurred"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRequestFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="requesterName">{t("bookings.yourName")} *</Label>
            <Input
              id="requesterName"
              name="requesterName"
              value={requestFormData.requesterName}
              onChange={handleInputChange}
              placeholder={t("bookings.yourNamePlaceholder")}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="requesterEmail">{t("bookings.yourEmail")} *</Label>
            <Input
              id="requesterEmail"
              name="requesterEmail"
              type="email"
              value={requestFormData.requesterEmail}
              onChange={handleInputChange}
              placeholder={t("bookings.yourEmailPlaceholder")}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="requesterPhone">{t("bookings.yourPhone")}</Label>
            <Input
              id="requesterPhone"
              name="requesterPhone"
              value={requestFormData.requesterPhone}
              onChange={handleInputChange}
              placeholder={t("bookings.yourPhonePlaceholder")}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("bookings.startDate")} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP HH:mm") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        const newStartDate = new Date(date);
                        newStartDate.setHours(startDate.getHours(), startDate.getMinutes());
                        setStartDate(newStartDate);
                        
                        // Also update end date to be 1 hour after start date
                        const newEndDate = new Date(newStartDate);
                        newEndDate.setHours(newStartDate.getHours() + 1);
                        setEndDate(newEndDate);
                      }
                    }}
                    initialFocus
                  />
                  <div className="p-3 border-t border-border">
                    <Label>{t("bookings.time")}</Label>
                    <div className="flex space-x-2 mt-2">
                      <select
                        value={startDate.getHours()}
                        onChange={(e) => {
                          const newStartDate = new Date(startDate);
                          newStartDate.setHours(parseInt(e.target.value));
                          setStartDate(newStartDate);
                          
                          // Update end date if it's less than start date
                          if (endDate <= newStartDate) {
                            const newEndDate = new Date(newStartDate);
                            newEndDate.setHours(newStartDate.getHours() + 1);
                            setEndDate(newEndDate);
                          }
                        }}
                        className="flex-1 border rounded px-2 py-1"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i.toString().padStart(2, '0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>{t("bookings.endDate")} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP HH:mm") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        const newEndDate = new Date(date);
                        newEndDate.setHours(endDate.getHours(), endDate.getMinutes());
                        setEndDate(newEndDate);
                      }
                    }}
                    initialFocus
                  />
                  <div className="p-3 border-t border-border">
                    <Label>{t("bookings.time")}</Label>
                    <div className="flex space-x-2 mt-2">
                      <select
                        value={endDate.getHours()}
                        onChange={(e) => {
                          const newEndDate = new Date(endDate);
                          newEndDate.setHours(parseInt(e.target.value));
                          setEndDate(newEndDate);
                        }}
                        className="flex-1 border rounded px-2 py-1"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i.toString().padStart(2, '0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">{t("bookings.notes")}</Label>
            <Textarea
              id="notes"
              name="notes"
              value={requestFormData.notes}
              onChange={handleInputChange}
              placeholder={t("bookings.notesPlaceholder")}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>{t("bookings.attachFile")}</Label>
            <FileUploadField
              ref={fileInputRef}
              onChange={(file) => setSelectedFile(file)}
              acceptedFileTypes="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.submitting")}
              </>
            ) : (
              t("bookings.submitRequest")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
