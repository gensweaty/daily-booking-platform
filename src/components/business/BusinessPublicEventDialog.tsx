
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, addHours } from "date-fns";
import { useEventRequests } from "@/hooks/useEventRequests";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface BusinessPublicEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  businessId: string;
}

export const BusinessPublicEventDialog = ({ 
  open, 
  onOpenChange, 
  selectedDate, 
  businessId 
}: BusinessPublicEventDialogProps) => {
  const { t } = useLanguage();
  const { createRequest } = useEventRequests(businessId);
  const { toast } = useToast();
  
  // Initialize start date to current date at 9am if selectedDate is today
  const initialStartDate = new Date(selectedDate);
  initialStartDate.setHours(9, 0, 0, 0);
  
  // Initialize end date to start date + 1 hour
  const initialEndDate = addHours(initialStartDate, 1);
  
  const [formData, setFormData] = useState({
    title: "",
    user_surname: "",
    user_number: "",
    social_network_link: "",
    event_notes: "",
    start_date: format(initialStartDate, "yyyy-MM-dd'T'HH:mm"),
    end_date: format(initialEndDate, "yyyy-MM-dd'T'HH:mm"),
    type: "private_party",
    payment_status: "not_paid",
    payment_amount: ""
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title) {
      toast({
        title: "Error",
        description: "Please enter an event title",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      
      if (startDate >= endDate) {
        toast({
          title: "Error",
          description: "End time must be after start time",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      await createRequest({
        business_id: businessId,
        title: formData.title,
        user_surname: formData.user_surname,
        user_number: formData.user_number,
        social_network_link: formData.social_network_link,
        event_notes: formData.event_notes,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        type: formData.type,
        payment_status: formData.payment_status,
        payment_amount: formData.payment_amount ? parseFloat(formData.payment_amount) : undefined
      });
      
      toast({
        title: "Success",
        description: "Your booking request has been submitted successfully!",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating event request:", error);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Book an Event</DialogTitle>
          <DialogDescription>
            Fill out the form below to request a booking
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter event title"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="user_surname">Your Name</Label>
            <Input
              id="user_surname"
              name="user_surname"
              value={formData.user_surname}
              onChange={handleChange}
              placeholder="Enter your name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="user_number">Phone Number</Label>
            <Input
              id="user_number"
              name="user_number"
              value={formData.user_number}
              onChange={handleChange}
              placeholder="Enter your phone number"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="social_network_link">Email / Social Media</Label>
            <Input
              id="social_network_link"
              name="social_network_link"
              value={formData.social_network_link}
              onChange={handleChange}
              placeholder="Enter your email or social media handle"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date & Time *</Label>
              <Input
                id="start_date"
                type="datetime-local"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date & Time *</Label>
              <Input
                id="end_date"
                type="datetime-local"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">Event Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => handleSelectChange("type", value)}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private_party">Private Party</SelectItem>
                <SelectItem value="corporate">Corporate Event</SelectItem>
                <SelectItem value="celebration">Celebration</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="event_notes">Notes</Label>
            <Textarea
              id="event_notes"
              name="event_notes"
              value={formData.event_notes}
              onChange={handleChange}
              placeholder="Enter any additional information"
              rows={3}
            />
          </div>
          
          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
