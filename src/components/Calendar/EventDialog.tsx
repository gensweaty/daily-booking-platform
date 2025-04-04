
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { format } from "date-fns";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  event?: CalendarEventType;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<any>;
  onDelete?: (id: string) => Promise<void>;
  businessId?: string;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  event,
  onSubmit,
  onDelete,
  businessId
}: EventDialogProps) => {
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [type, setType] = useState("private");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  
  const isUpdateMode = !!event;

  useEffect(() => {
    if (event) {
      setTitle(event.title || "");
      setUserSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setType(event.type || "private");
      setPaymentStatus(event.payment_status || "");
      setPaymentAmount(event.payment_amount ? event.payment_amount.toString() : "");
      
      // Set dates from the event
      const startDateObj = new Date(event.start_date);
      const endDateObj = new Date(event.end_date);
      setStartDate(format(startDateObj, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(endDateObj, "yyyy-MM-dd'T'HH:mm"));
    } else {
      // Reset form when creating a new event
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setType("private");
      setPaymentStatus("");
      setPaymentAmount("");
      
      // Set dates from selectedDate
      const start = new Date(selectedDate);
      start.setHours(9, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(10, 0, 0, 0);
      
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [event, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title) {
      alert("Title is required");
      return;
    }
    
    if (!startDate || !endDate) {
      alert("Start and end dates are required");
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const data: Partial<CalendarEventType> = {
        title,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        type,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
      };
      
      // Only add business_id if provided and not null
      if (businessId) {
        data.business_id = businessId;
      }
      
      await onSubmit(data);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || !onDelete) return;
    
    try {
      setIsSubmitting(true);
      await onDelete(event.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onFileDeleted = async (fileId: string) => {
    console.log(`File with ID ${fileId} deleted`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isUpdateMode ? "Update Event" : "Create New Event"}</DialogTitle>
          <DialogDescription>
            {isUpdateMode ? "Update your event details below." : "Fill in the details to create a new event."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <EventDialogFields 
            title={title}
            setTitle={setTitle}
            userSurname={userSurname}
            setUserSurname={setUserSurname}
            userNumber={userNumber}
            setUserNumber={setUserNumber}
            socialNetworkLink={socialNetworkLink}
            setSocialNetworkLink={setSocialNetworkLink}
            eventNotes={eventNotes}
            setEventNotes={setEventNotes}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            eventId={event?.id}
            onFileDeleted={onFileDeleted}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            {isUpdateMode && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            )}
            
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : (isUpdateMode ? "Update" : "Save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
