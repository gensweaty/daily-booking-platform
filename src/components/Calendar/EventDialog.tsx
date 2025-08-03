import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventDialogFields } from './EventDialogFields';
import { useToast } from '@/hooks/use-toast';

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEventType;
  onSave: (eventData: CalendarEventType, file: File | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  date?: string;
  businessId?: string;
}

export const EventDialog: React.FC<EventDialogProps> = ({
  isOpen,
  onClose,
  event,
  onSave,
  onDelete,
  date,
  businessId
}) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [eventData, setEventData] = useState<CalendarEventType>(() => ({
    id: '',
    title: '',
    user_surname: '',
    user_number: '',
    social_network_link: '',
    event_notes: '',
    start_date: date || new Date().toISOString(),
    end_date: date || new Date().toISOString(),
    payment_status: 'not_paid',
    payment_amount: 0,
    type: 'event',
    user_id: user?.id || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_recurring: false,
    repeat_pattern: '',
    repeat_until: '',
    language: language,
    // Initialize reminder fields
    reminder_at: undefined,
    reminder_sent_at: undefined,
    email_reminder_enabled: false,
    ...event
  }));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
  };

  useEffect(() => {
    if (event) {
      setEventData({
        ...event,
        // Ensure reminder fields are properly set from the event data
        reminder_at: event.reminder_at,
        reminder_sent_at: event.reminder_sent_at,
        email_reminder_enabled: event.email_reminder_enabled || false,
      });
    } else if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration
      
      setEventData(prev => ({
        ...prev,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        language: language,
        // Reset reminder fields for new events
        reminder_at: undefined,
        reminder_sent_at: undefined,
        email_reminder_enabled: false,
      }));
    }
  }, [event, date, language, user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    
    try {
      const eventToSave = {
        ...eventData,
        user_id: user.id,
        language: language,
        // Include reminder fields in save data
        reminder_at: eventData.email_reminder_enabled ? eventData.reminder_at : null,
        email_reminder_enabled: eventData.email_reminder_enabled || false,
        reminder_sent_at: eventData.reminder_sent_at || null,
      };

      await onSave(eventToSave, selectedFile);
      onClose();
      setSelectedFile(null);
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      await onDelete(event.id);
      onClose();
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event ? t('calendar.editEvent') : t('calendar.createEvent')}
          </DialogTitle>
        </DialogHeader>

        <EventDialogFields
          eventData={eventData}
          setEventData={setEventData}
          onFileChange={handleFileChange}
          isEditing={!!event}
          onClose={onClose}
        />

        <DialogFooter className="flex justify-between">
          <div>
            {event && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                {t('common.delete')}
              </Button>
            )}
          </div>
          <div className="space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" onClick={handleSave}>
              {event ? t('common.save') : t('calendar.createEvent')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
