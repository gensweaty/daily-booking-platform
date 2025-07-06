
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  initialData?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

export function EventDialog({
  open,
  onOpenChange,
  selectedDate,
  initialData,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
}: EventDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  
  const isNewEvent = !initialData;
  const isChildEvent = initialData?.parent_event_id != null;
  
  // Form state
  const [formData, setFormData] = useState({
    user_surname: "",
    user_number: "",
    social_network_link: "",
    event_notes: "",
    event_name: "",
    payment_status: "not_paid",
    payment_amount: "",
    start_date: "",
    end_date: "",
  });

  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState<string>("weekly");
  const [repeatUntil, setRepeatUntil] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData({
        user_surname: initialData.user_surname || "",
        user_number: initialData.user_number || "",
        social_network_link: initialData.social_network_link || "",
        event_notes: initialData.event_notes || "",
        event_name: initialData.event_name || "",
        payment_status: initialData.payment_status || "not_paid",
        payment_amount: initialData.payment_amount?.toString() || "",
        start_date: initialData.start_date,
        end_date: initialData.end_date,
      });
      
      // Set recurring fields if this is a parent recurring event
      if (initialData.is_recurring && !isChildEvent) {
        setIsRecurring(true);
        setRepeatPattern(initialData.repeat_pattern || "weekly");
        setRepeatUntil(initialData.repeat_until || "");
      }
    } else if (selectedDate) {
      const startDate = new Date(selectedDate);
      const endDate = new Date(selectedDate);
      endDate.setHours(startDate.getHours() + 1);

      setFormData(prev => ({
        ...prev,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      }));
    }
  }, [initialData, selectedDate, isChildEvent]);

  // Reset recurring state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setIsRecurring(false);
      setRepeatPattern("weekly");
      setRepeatUntil("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create events",
        variant: "destructive",
      });
      return;
    }

    // Validate recurring event fields
    if (isRecurring && isNewEvent) {
      if (!repeatPattern || !["daily", "weekly", "monthly"].includes(repeatPattern)) {
        toast({
          title: "Error",
          description: "Please select a valid repeat pattern",
          variant: "destructive",
        });
        return;
      }

      if (!repeatUntil) {
        toast({
          title: "Error", 
          description: "Please select an end date for the recurring event",
          variant: "destructive",
        });
        return;
      }

      const startDate = new Date(formData.start_date);
      const untilDate = new Date(repeatUntil);
      
      if (untilDate <= startDate) {
        toast({
          title: "Error",
          description: "End date must be after the start date",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const eventData = {
        ...formData,
        type: "event",
        payment_amount: formData.payment_amount ? parseFloat(formData.payment_amount) : undefined,
        // Only include recurring fields for new events (not child events)
        is_recurring: isNewEvent && isRecurring,
        repeat_pattern: isNewEvent && isRecurring ? repeatPattern : null,
        repeat_until: isNewEvent && isRecurring && repeatUntil 
          ? repeatUntil.split('T')[0] // Ensure YYYY-MM-DD format
          : null,
      };

      console.log("Submitting event data:", eventData);

      if (initialData) {
        // Update existing event - convert payment_amount to number for the API
        const updateData = {
          ...eventData,
          id: initialData.id,
        };
        await updateEvent(updateData);
        onEventUpdated?.();
        toast({
          title: "Success",
          description: "Event updated successfully",
        });
      } else {
        // Create new event
        await createEvent(eventData);
        onEventCreated?.();
        
        if (isRecurring) {
          toast({
            title: "Success",
            description: "Recurring event series created successfully",
          });
          
          // Multi-stage refresh for recurring events
          setTimeout(() => window.location.reload(), 500);
          setTimeout(() => window.location.reload(), 1500);
          setTimeout(() => window.location.reload(), 3000);
        } else {
          toast({
            title: "Success",
            description: "Event created successfully",
          });
        }
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;

    try {
      await deleteEvent({ id: initialData.id });
      onEventDeleted?.();
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Event" : "Create New Event"}
            {isChildEvent && " (Part of Series)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <EventDialogFields
            formData={formData}
            setFormData={setFormData}
            isRecurring={isRecurring && isNewEvent}
          />

          {/* Recurring Event Options - Only show for new events */}
          {isNewEvent && !isChildEvent && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center space-x-2">
                <Switch
                  id="recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
                <Label htmlFor="recurring">Make this a recurring event</Label>
              </div>

              {isRecurring && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="repeat-pattern">Repeat Pattern</Label>
                    <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select repeat pattern" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="repeat-until">Repeat Until</Label>
                    <Input
                      id="repeat-until"
                      type="date"
                      value={repeatUntil}
                      onChange={(e) => setRepeatUntil(e.target.value)}
                      min={formData.start_date ? format(new Date(formData.start_date), "yyyy-MM-dd") : undefined}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <div>
              {initialData && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  Delete Event
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting 
                  ? (initialData ? "Updating..." : "Creating...") 
                  : (initialData ? "Update Event" : "Create Event")
                }
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
