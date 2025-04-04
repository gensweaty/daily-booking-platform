
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookingRequestFormProps {
  businessId: string;
  selectedDate?: Date;
  onSuccess: () => void;
}

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  onSuccess,
}: BookingRequestFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();

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
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      startDate.setHours(startHours, startMinutes, 0, 0);

      const endDate = new Date(selectedDate);
      const [endHours, endMinutes] = endTime.split(":").map(Number);
      endDate.setHours(endHours, endMinutes, 0, 0);

      // Insert booking request - if user is logged in, associate with their ID, otherwise just use public booking
      const { error } = await supabase.from("booking_requests").insert({
        business_id: businessId,
        user_id: user?.id || null, // Allow null for public bookings
        requester_name: name,
        requester_email: email,
        requester_phone: phone,
        title: title || `Booking for ${name}`,
        description,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your booking request has been submitted!",
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
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="endTime" className="block text-sm font-medium">End Time</label>
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
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
