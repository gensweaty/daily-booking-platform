import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { CalendarEvent } from "@/lib/types";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onSubmit: (data: Partial<CalendarEvent>) => void;
  event?: CalendarEvent;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  event,
}: EventDialogProps) => {
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [location, setLocation] = useState(event?.location || "");
  const [type, setType] = useState<"meeting" | "reminder">(event?.type || "meeting");
  const [startDate, setStartDate] = useState(
    event?.start_date || (selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : "")
  );
  const [endDate, setEndDate] = useState(
    event?.end_date || (selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : "")
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      location,
      start_date: startDate,
      end_date: endDate,
      type,
    });
    setTitle("");
    setDescription("");
    setLocation("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{event ? "Edit Event" : "Add New Event"}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Input
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Select value={type} onValueChange={(value) => setType(value as "meeting" | "reminder")}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="reminder">Reminder</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <Input
            placeholder="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button type="submit" className="w-full">
            {event ? "Update Event" : "Create Event"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};