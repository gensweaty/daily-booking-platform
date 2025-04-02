import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BookingRequest } from "@/types/database";
import { createBookingRequest } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookingRequestFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  businessId: string;
  selectedDate?: Date | null;
  startTime?: string;
  endTime?: string;
  onSuccess?: () => void;
}

export const BookingRequestForm = ({
  open,
  onOpenChange,
  businessId,
  selectedDate,
  startTime,
  endTime,
  onSuccess,
}: BookingRequestFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Format date to ISO string for input fields
  const formatDateForInput = (date: Date) => {
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setHours(9, 0, 0, 0);
  
  const defaultEnd = new Date(today);
  defaultEnd.setHours(10, 0, 0, 0);

  // Use provided startTime and endTime if available
  let startDateTime = selectedDate ? new Date(selectedDate) : new Date(defaultStart);
  let endDateTime = selectedDate ? new Date(selectedDate) : new Date(defaultEnd);
  
  if (selectedDate && startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);
  }
  
  if (selectedDate && endTime) {
    const [hours, minutes] = endTime.split(':').map(Number);
    endDateTime.setHours(hours, minutes, 0, 0);
  } else if (selectedDate && !endTime && startTime) {
    // Default to 1 hour duration if only start time is provided
    const [hours, minutes] = startTime.split(':').map(Number);
    endDateTime.setHours(hours + 1, minutes, 0, 0);
  }

  const [formData, setFormData] = useState({
    name: user?.user_metadata?.name || "",
    email: user?.email || "",
    phone: "",
    title: "",
    description: "",
    startDate: formatDateForInput(startDateTime),
    endDate: formatDateForInput(endDateTime),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.title) newErrors.title = "Title is required";
    
    // Validate dates
    if (!formData.startDate) {
      newErrors.startDate = "Start date is required";
    }
    
    if (!formData.endDate) {
      newErrors.endDate = "End date is required";
    } else if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      newErrors.endDate = "End date must be after start date";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when field is corrected
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      const bookingData: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id"> = {
        business_id: businessId,
        requester_name: formData.name,
        requester_email: formData.email,
        requester_phone: formData.phone,
        title: formData.title,
        description: formData.description,
        start_date: new Date(formData.startDate).toISOString(),
        end_date: new Date(formData.endDate).toISOString(),
      };
      
      // Send the booking request
      const createdBooking = await createBookingRequest(bookingData);
      
      // Handle file upload if a file is selected
      if (selectedFile && createdBooking?.id) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `booking_attachments/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          throw uploadError;
        }
        
        const { error: insertError } = await supabase
          .from('booking_attachments')
          .insert({
            booking_id: createdBooking.id,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user?.id || null
          });
          
        if (insertError) {
          console.error('Error saving file data:', insertError);
          // Don't throw here, we'll just continue with the booking
        }
      }
      
      toast({
        title: t("bookings.requestSubmitted"),
        description: t("bookings.requestSubmittedDesc"),
      });
      
      // Reset form and close dialog
      setFormData({
        name: "",
        email: "",
        phone: "",
        title: "",
        description: "",
        startDate: formatDateForInput(defaultStart),
        endDate: formatDateForInput(defaultEnd),
      });
      setSelectedFile(null);
      onOpenChange?.(false);
      
      // Trigger success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error submitting booking request:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("bookings.requestFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bookings.requestBooking")}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t("bookings.yourName")} *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">{t("bookings.yourEmail")} *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">{t("bookings.yourPhone")}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">{t("bookings.appointmentTitle")} *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && <p className="text-red-500 text-sm">{errors.title}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("bookings.startDateTime")} *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="datetime-local"
                value={formData.startDate}
                onChange={handleChange}
                className={errors.startDate ? "border-red-500" : ""}
                min={formatDateForInput(new Date())}
              />
              {errors.startDate && <p className="text-red-500 text-sm">{errors.startDate}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t("bookings.endDateTime")} *</Label>
              <Input
                id="endDate"
                name="endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={handleChange}
                className={errors.endDate ? "border-red-500" : ""}
                min={formData.startDate || formatDateForInput(new Date())}
              />
              {errors.endDate && <p className="text-red-500 text-sm">{errors.endDate}</p>}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t("bookings.description")}</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="min-h-[100px]"
            />
          </div>
          
          <FileUploadField 
            onChange={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            hideLabel={true}
            hideDescription={true}
          />
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.submitting") : t("bookings.submitRequest")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
