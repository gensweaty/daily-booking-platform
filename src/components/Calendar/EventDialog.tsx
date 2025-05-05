
import React from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventDialogFields } from "./EventDialogFields";
import { useLanguage } from "@/contexts/LanguageContext";

export interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  event: CalendarEventType | null;
  isExternalCalendar?: boolean;
}

export function EventDialog({
  open,
  onClose,
  event,
  isExternalCalendar = false,
}: EventDialogProps) {
  const { t } = useLanguage();

  if (!event) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {t("events.eventDetails")}
          </DialogDescription>
        </DialogHeader>
        <EventDialogFields 
          eventData={event} 
          isExternalCalendar={isExternalCalendar} 
        />
        <DialogFooter>
          <Button onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
