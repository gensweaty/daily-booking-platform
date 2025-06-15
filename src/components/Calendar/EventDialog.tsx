
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { useLanguage } from "@/contexts/LanguageContext";

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

  const handleSubmit = async (eventData: Partial<CalendarEventType>) => {
    setIsSubmitting(true);
    try {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event ? t("events.editEvent") : t("events.addNewEvent")}
          </DialogTitle>
        </DialogHeader>

        <EventDialogFields
          selectedDate={selectedDate}
          event={event}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />

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
