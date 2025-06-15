
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { FileRecord } from "@/types/files";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  event?: CalendarEventType;
  onSubmit: (eventData: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onDelete?: () => Promise<void>;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  event,
  onSubmit,
  onDelete,
}: EventDialogProps) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<FileRecord[]>([]);
  
  // Group event state
  const [isGroupEvent, setIsGroupEvent] = useState(false);
  const [groupName, setGroupName] = useState("");

  // Initialize form with event data or default values
  useEffect(() => {
    if (event) {
      setTitle(event.title || "");
      setUserSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setStartDate(format(new Date(event.start_date), "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm"));
      setPaymentStatus(event.payment_status || "not_paid");
      setPaymentAmount(event.payment_amount?.toString() || "");
      setIsGroupEvent(event.is_group_event || false);
      setGroupName(event.group_name || "");
      
      // Handle files
      if (event.files) {
        const files: FileRecord[] = event.files.map(file => ({
          id: file.id,
          filename: file.filename,
          file_path: file.file_path,
          content_type: file.content_type,
          size: file.size,
          user_id: event.user_id,
          created_at: new Date().toISOString(),
          source: 'event_attachments'
        }));
        setDisplayedFiles(files);
      } else {
        setDisplayedFiles([]);
      }
    } else if (selectedDate) {
      // Reset form for new event
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setStartDate(format(selectedDate, "yyyy-MM-dd'T'HH:mm"));
      
      const endDateTime = new Date(selectedDate);
      endDateTime.setHours(selectedDate.getHours() + 1);
      setEndDate(format(endDateTime, "yyyy-MM-dd'T'HH:mm"));
      
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setIsGroupEvent(false);
      setGroupName("");
      setDisplayedFiles([]);
    }
    
    setSelectedFile(null);
    setFileError("");
  }, [event, selectedDate, open]);

  // Update title when group name or user surname changes
  useEffect(() => {
    if (isGroupEvent && groupName) {
      setTitle(groupName);
    } else if (!isGroupEvent && userSurname) {
      setTitle(userSurname);
    }
  }, [isGroupEvent, groupName, userSurname]);

  const handleFormSubmit = async () => {
    setIsSubmitting(true);
    try {
      const eventData: Partial<CalendarEventType> = {
        title: isGroupEvent ? groupName : userSurname,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        start_date: startDate,
        end_date: endDate,
        payment_status: paymentStatus,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        file: selectedFile || undefined,
        is_group_event: isGroupEvent,
        group_name: isGroupEvent ? groupName : undefined,
      };

      if (event) {
        eventData.id = event.id;
      }

      await onSubmit(eventData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting event:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event ? t("events.editEvent") : t("events.addNewEvent")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }} className="space-y-4">
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
            displayedFiles={displayedFiles}
            onFileDeleted={handleFileDeleted}
            isGroupEvent={isGroupEvent}
            setIsGroupEvent={setIsGroupEvent}
            groupName={groupName}
            setGroupName={setGroupName}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("common.saving") : (event ? t("common.save") : t("common.create"))}
            </Button>
          </div>
        </form>

        {event && onDelete && (
          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t("common.deleting") : t("events.deleteEvent")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
