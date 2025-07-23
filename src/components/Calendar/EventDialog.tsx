
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { deleteCalendarEvent } from "@/services/calendarService";
import { useAuth } from "@/contexts/AuthContext";

interface EventDialogProps {
  event: CalendarEventType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (event: CalendarEventType) => void;
  onDelete: (id: string, deleteChoice?: "this" | "series") => void;
}

export const EventDialog = ({
  event,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: EventDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [editedEvent, setEditedEvent] = useState<CalendarEventType | null>(null);
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (event) {
      setEditedEvent({ ...event });
    }
  }, [event]);

  const handleSave = () => {
    if (editedEvent) {
      onSave(editedEvent);
      onOpenChange(false);
    }
  };

  const handleDeleteClick = () => {
    if (!editedEvent) return;
    
    // Check if this is a recurring event
    if (editedEvent.is_recurring || editedEvent.parent_event_id) {
      setShowRecurringDeleteDialog(true);
    } else {
      handleDeleteConfirm();
    }
  };

  const handleDeleteConfirm = async (deleteChoice?: "this" | "series") => {
    if (!editedEvent || !user?.id) return;

    setIsDeleting(true);
    console.log('[EventDialog] 🎯 Starting ENHANCED deletion process for event:', {
      id: editedEvent.id,
      title: editedEvent.title,
      type: editedEvent.type,
      deleteChoice,
      isRecurring: editedEvent.is_recurring,
      parentEventId: editedEvent.parent_event_id,
      bookingRequestId: (editedEvent as any).booking_request_id
    });

    try {
      // Determine the correct event type based on the data
      const eventType = editedEvent.type === 'booking_request' ? 'booking_request' : 'event';
      
      console.log('[EventDialog] 🔍 Determined event type:', eventType);

      // Use the enhanced deleteCalendarEvent function
      await deleteCalendarEvent(editedEvent.id, eventType, user.id);
      
      console.log('[EventDialog] ✅ Deletion successful, calling onDelete callback');
      
      // Call the parent's onDelete callback to trigger UI updates
      onDelete(editedEvent.id, deleteChoice);
      
      // Close dialogs
      setShowRecurringDeleteDialog(false);
      onOpenChange(false);
      
      toast({
        title: t("common.success"),
        description: t("events.deleteEventSuccess"),
      });
      
    } catch (error) {
      console.error('[EventDialog] ❌ Error deleting event:', error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("events.deleteEventError"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFieldChange = (field: keyof CalendarEventType, value: any) => {
    if (editedEvent) {
      setEditedEvent({ ...editedEvent, [field]: value });
    }
  };

  if (!editedEvent) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editedEvent.id ? t("events.editEvent") : t("events.addEvent")}
            </DialogTitle>
          </DialogHeader>

          <EventDialogFields
            event={editedEvent}
            onFieldChange={handleFieldChange}
          />

          <div className="flex justify-between">
            <div>
              {editedEvent.id && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                >
                  {isDeleting ? t("common.loading") : t("events.deleteEvent")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={showRecurringDeleteDialog}
        onOpenChange={setShowRecurringDeleteDialog}
        onDeleteThis={() => handleDeleteConfirm("this")}
        onDeleteSeries={() => handleDeleteConfirm("series")}
        isRecurringEvent={editedEvent.is_recurring || !!editedEvent.parent_event_id}
        isLoading={isDeleting}
      />
    </>
  );
};
