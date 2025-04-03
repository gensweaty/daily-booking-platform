
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { createBookingRequest } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { supabase } from "@/lib/supabase";

export interface BookingRequestFormProps {
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
  onSuccess,
}: BookingRequestFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [start, setStart] = useState(startTime || "09:00");
  const [end, setEnd] = useState(endTime || "10:00");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const startDateTime = new Date(`${date}T${start}`);
      const endDateTime = new Date(`${date}T${end}`);
      
      let fileUrl = null;
      let fileName = null;
      let fileSize = null;
      let fileType = null;
      
      // Upload file if present
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('booking_attachments')
          .upload(filePath, selectedFile);
          
        if (uploadError) {
          throw uploadError;
        }
        
        fileUrl = filePath;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = selectedFile.type;
      }
      
      // Create booking request
      const bookingData = {
        business_id: businessId,
        requester_name: name,
        requester_email: email,
        requester_phone: phone,
        title: name, // Use requester name as title
        description: description,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        social_network_link: socialLink,
        payment_status: paymentStatus,
        payment_amount: paymentStatus !== "unpaid" ? Number(paymentAmount) : undefined,
      };
      
      const booking = await createBookingRequest(bookingData);
      
      // If we have a file, create booking file record
      if (fileUrl && booking?.id) {
        const { error: fileError } = await supabase
          .from('booking_files')
          .insert({
            booking_id: booking.id,
            filename: fileName,
            file_path: fileUrl,
            content_type: fileType,
            size: fileSize,
            user_id: null, // Public booking
          });
          
        if (fileError) {
          console.error('Error saving file metadata:', fileError);
        }
      }
      
      toast({
        title: "Booking request submitted",
        description: "Your booking request has been submitted and is awaiting approval",
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error creating booking request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit booking request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
  };

  return (
    <div className="space-y-6 p-2">
      <h2 className="text-xl font-bold">Request Booking</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Your Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="email">Your Email *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="phone">Your Phone</Label>
          <Input
            id="phone"
            value={phone}
            placeholder="Phone number"
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="socialLink">Social Link or Email</Label>
          <Input
            id="socialLink"
            value={socialLink}
            placeholder="Instagram, Facebook, or additional email"
            onChange={(e) => setSocialLink(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="startDate">Start Date & Time *</Label>
            <div className="flex space-x-2">
              <Input
                id="startDate"
                type="text"
                value={`${date} ${start}`}
                readOnly
                className="bg-muted"
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="endDate">End Date & Time *</Label>
            <div className="flex space-x-2">
              <Input
                id="endDate"
                type="text" 
                value={`${date} ${end}`}
                readOnly
                className="bg-muted"
                required
              />
            </div>
          </div>
        </div>
        
        <div>
          <Label htmlFor="paymentStatus">Payment Status</Label>
          <Select 
            value={paymentStatus} 
            onValueChange={setPaymentStatus}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partially_paid">Paid Partially</SelectItem>
              <SelectItem value="fully_paid">Paid Fully</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-1">
            Payment status will be set after your booking is approved
          </p>
        </div>
        
        {paymentStatus !== "unpaid" && (
          <div>
            <Label htmlFor="paymentAmount">Payment Amount ($)</Label>
            <Input
              id="paymentAmount"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
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
            rows={4}
          />
        </div>
        
        <div>
          <FileUploadField
            onChange={handleFileChange}
            fileError={fileError}
            setFileError={setFileError}
            acceptedFileTypes="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Max size: Images 2MB, Documents 1MB (2 MB for images, 1 MB for documents)
            <br />
            Supported formats: JPG, PNG, PDF, DOCX, XLSX, PPTX
          </p>
        </div>
        
        <Button 
          type="submit" 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Request"}
        </Button>
      </form>
    </div>
  );
};
