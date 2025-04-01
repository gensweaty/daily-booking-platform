
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createBookingRequest } from "@/lib/api";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { format, addHours, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// Define form schema
const bookingRequestSchema = z.object({
  requester_name: z.string().min(2, { message: "Name is required" }),
  requester_surname: z.string().optional(),
  requester_email: z.string().email({ message: "Valid email is required" }),
  requester_phone: z.string().optional(),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  social_network_link: z.string().optional(),
  event_notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingRequestSchema>;

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { user } = useAuth();

  // Set up form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: {
      requester_name: "",
      requester_surname: "",
      requester_email: "",
      requester_phone: "",
      title: "",
      description: "",
      social_network_link: "",
      event_notes: "",
    },
  });

  const formatDateWithTime = (date: Date, timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate.toISOString();
  };

  const onSubmit = async (data: BookingFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Format dates
      const startDateTime = formatDateWithTime(selectedDate, startTime);
      const endDateTime = formatDateWithTime(selectedDate, endTime);
      
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
        title: data.title,
        description: data.description,
        requester_name: data.requester_name,
        requester_email: data.requester_email,
        requester_phone: data.requester_phone || null,
        start_date: startDateTime,
        end_date: endDateTime,
        // Pass these as custom fields that will be stored in the same table
        user_surname: data.requester_surname,
        user_number: data.requester_phone,
        social_network_link: data.social_network_link,
        event_notes: data.event_notes,
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

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setFileError("");
  };

  return (
    <div className="space-y-4 p-1">
      <h2 className="text-xl font-bold mb-4">Request a Booking</h2>
      <p className="text-sm text-muted-foreground mb-4">
        For {format(selectedDate, "EEEE, MMMM d, yyyy")} from {startTime} to {endTime}
      </p>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="requester_name">Your Name*</Label>
            <Input 
              id="requester_name" 
              {...register("requester_name")} 
              placeholder="John" 
            />
            {errors.requester_name && (
              <p className="text-sm text-red-500 mt-1">{errors.requester_name.message}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="requester_surname">Surname</Label>
            <Input 
              id="requester_surname" 
              {...register("requester_surname")} 
              placeholder="Doe" 
            />
          </div>

          <div>
            <Label htmlFor="requester_email">Email*</Label>
            <Input 
              id="requester_email" 
              type="email" 
              {...register("requester_email")} 
              placeholder="john.doe@example.com" 
            />
            {errors.requester_email && (
              <p className="text-sm text-red-500 mt-1">{errors.requester_email.message}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="requester_phone">Phone Number</Label>
            <Input 
              id="requester_phone" 
              type="tel" 
              {...register("requester_phone")} 
              placeholder="+1234567890" 
            />
          </div>
        </div>

        <div>
          <Label htmlFor="title">Booking Title*</Label>
          <Input 
            id="title" 
            {...register("title")} 
            placeholder="e.g., Consultation Meeting" 
          />
          {errors.title && (
            <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="social_network_link">Social Media Link</Label>
          <Input 
            id="social_network_link" 
            {...register("social_network_link")} 
            placeholder="e.g., Instagram profile" 
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea 
            id="description" 
            {...register("description")} 
            placeholder="Briefly describe what this booking is for..." 
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="event_notes">Additional Notes</Label>
          <Textarea 
            id="event_notes" 
            {...register("event_notes")} 
            placeholder="Any additional information..." 
            rows={3}
          />
        </div>

        <div>
          <Label>Attachment (Optional)</Label>
          <FileUploadField
            onFileChange={handleFileChange}
            fileError={fileError}
            setFileError={setFileError}
            acceptedFileTypes="image/*,.pdf,.doc,.docx"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Upload a file related to your booking (images, documents, etc.)
          </p>
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Booking Request"}
        </Button>
      </form>
    </div>
  );
};
