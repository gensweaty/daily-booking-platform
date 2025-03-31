
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EventDialogFields } from "@/components/Calendar/EventDialogFields";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { CalendarEventType } from "@/lib/types/calendar";

interface BookingRequestFormProps {
  businessId: string;
  selectedDate?: Date;
  startTime?: string;
  endTime?: string;
  onSuccess: () => void;
}

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  startTime = "09:00",
  endTime = "10:00",
  onSuccess,
}: BookingRequestFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [localStartTime, setLocalStartTime] = useState(startTime);
  const [localEndTime, setLocalEndTime] = useState(endTime);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // Set initial values when form opens
  useEffect(() => {
    setTitle("");
    setName("");
    setEmail("");
    setPhone("");
    setDescription("");
    setLocalStartTime(startTime);
    setLocalEndTime(endTime);
    setUserSurname("");
    setUserNumber("");
    setSocialNetworkLink("");
    setEventNotes("");
    setSelectedFile(null);
    setFileError("");
  }, [startTime, endTime]);

  const checkTimeSlotAvailability = async (startDate: Date, endDate: Date): Promise<boolean> => {
    try {
      console.log("Checking time slot availability for:", {
        businessId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // 1. Get business user ID
      const { data: businessProfile, error: businessError } = await supabase
        .from("business_profiles")
        .select("user_id")
        .eq("id", businessId)
        .single();
      
      if (businessError) {
        console.error("Error fetching business user ID:", businessError);
        return false;
      }

      if (!businessProfile?.user_id) {
        console.error("No user ID found for business:", businessId);
        return false;
      }

      // 2. Check for existing events in this time slot
      const { data: existingEvents, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", businessProfile.user_id)
        .lte("start_date", endDate.toISOString())
        .gte("end_date", startDate.toISOString());
      
      if (eventsError) {
        console.error("Error checking for existing events:", eventsError);
        return false;
      }

      // 3. Check for existing approved bookings in this time slot
      const { data: existingBookings, error: bookingsError } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("business_id", businessId)
        .eq("status", "approved")
        .lte("start_date", endDate.toISOString())
        .gte("end_date", startDate.toISOString());
      
      if (bookingsError) {
        console.error("Error checking for existing bookings:", bookingsError);
        return false;
      }

      // 4. Check for any pending booking requests in this time slot
      const { data: pendingBookings, error: pendingError } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("business_id", businessId)
        .eq("status", "pending")
        .lte("start_date", endDate.toISOString())
        .gte("end_date", startDate.toISOString());
      
      if (pendingError) {
        console.error("Error checking for pending bookings:", pendingError);
        return false;
      }

      const hasConflicts = (existingEvents && existingEvents.length > 0) || 
                          (existingBookings && existingBookings.length > 0) ||
                          (pendingBookings && pendingBookings.length > 0);
      
      console.log("Time slot availability check result:", {
        existingEvents: existingEvents?.length || 0,
        existingBookings: existingBookings?.length || 0,
        pendingBookings: pendingBookings?.length || 0,
        isAvailable: !hasConflicts
      });
      
      return !hasConflicts;
    } catch (error) {
      console.error("Error in checkTimeSlotAvailability:", error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      toast({
        title: "Error",
        description: "Please select a date for your booking",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Create start and end date objects
      const startDate = new Date(selectedDate);
      const [startHours, startMinutes] = localStartTime.split(":").map(Number);
      startDate.setHours(startHours, startMinutes, 0, 0);

      const endDate = new Date(selectedDate);
      const [endHours, endMinutes] = localEndTime.split(":").map(Number);
      endDate.setHours(endHours, endMinutes, 0, 0);

      // Check if this time slot is available
      const isAvailable = await checkTimeSlotAvailability(startDate, endDate);
      
      if (!isAvailable) {
        toast({
          title: "Time Slot Unavailable",
          description: "This time slot is already booked or has a pending request. Please choose a different time.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Insert booking request - if user is logged in, associate with their ID, otherwise just use public booking
      const { data: bookingData, error } = await supabase.from("booking_requests").insert({
        business_id: businessId,
        user_id: user?.id || null, // Allow null for public bookings
        requester_name: name,
        requester_email: email,
        requester_phone: phone,
        title: title || `Booking for ${name}`,
        description: description || eventNotes,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: "pending",
      }).select().single();

      if (error) throw error;

      // If file was uploaded, save it
      if (selectedFile && bookingData?.id) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const fileData = {
          filename: selectedFile.name,
          file_path: filePath,
          content_type: selectedFile.type,
          size: selectedFile.size,
          user_id: user?.id || null
        };

        // Save file reference for the booking request
        const { error: fileError } = await supabase
          .from('event_files')
          .insert({
            ...fileData,
            event_id: bookingData.id
          });

        if (fileError) throw fileError;
      }

      // Play notification sound to alert business owner
      const audio = new Audio("/audio/notification.mp3");
      audio.play().catch(e => console.log("Audio play failed:", e));

      toast({
        title: "Success",
        description: "Your booking request has been submitted! You'll receive a notification when it's approved.",
      });

      // Reset form and notify parent component
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit booking request",
        variant: "destructive",
      });
      console.error("Booking request error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">Request a Booking</h2>
      
      {selectedDate && (
        <p className="text-muted-foreground mb-4">
          Booking for: {format(selectedDate, "EEEE, MMMM d, yyyy")}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium">Full Name</label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="phone" className="block text-sm font-medium">Phone Number</label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium">Booking Title</label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="startTime" className="block text-sm font-medium">Start Time</label>
          <Input
            id="startTime"
            type="time"
            value={localStartTime}
            onChange={(e) => setLocalStartTime(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="endTime" className="block text-sm font-medium">End Time</label>
          <Input
            id="endTime"
            type="time"
            value={localEndTime}
            onChange={(e) => setLocalEndTime(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium">Additional Information</label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* File upload field */}
      <FileUploadField
        onFileChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Request"}
        </Button>
      </div>
    </form>
  );
};
