
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { EventDialogFields } from './EventDialogFields';
import { RecurringDeleteDialog } from './RecurringDeleteDialog';
import { CalendarEventType } from '@/lib/types/calendar';
import { isVirtualInstance } from '@/lib/recurringEvents';
import { useToast } from '@/hooks/use-toast';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventData?: CalendarEventType;
  selectedDate?: Date;
  onSave: (eventData: Partial<CalendarEventType>) => Promise<void>;
  onDelete?: (id: string, deleteChoice?: "this" | "series") => Promise<void>;
}

export const EventDialog: React.FC<EventDialogProps> = ({
  open,
  onOpenChange,
  eventData,
  selectedDate,
  onSave,
  onDelete,
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<CalendarEventType>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRecurringDeleteOpen, setIsRecurringDeleteOpen] = useState(false);

  const isBookingRequest = eventData?.type === 'booking_request';
  const isVirtualEvent = eventData && isVirtualInstance(eventData.id || '');
  const isNewEvent = !eventData;

  const handleClose = () => {
    onOpenChange(false);
    // Reset form data when closing
    setFormData({});
  };

  // Initialize form data when dialog opens or eventData changes
  useEffect(() => {
    if (open) {
      if (eventData) {
        // Editing existing event - populate with all existing data
        const reminderEnabled = eventData.email_reminder_enabled || false;
        const reminderAt = eventData.reminder_at || null;
        
        setFormData({
          ...eventData,
          email_reminder_enabled: reminderEnabled,
          reminder_at: reminderAt,
        });
      } else if (selectedDate) {
        // Creating new event - set proper default times (9:00-10:00)
        const defaultStart = new Date(selectedDate);
        defaultStart.setHours(9, 0, 0, 0); // Set to 9:00 AM
        
        const defaultEnd = new Date(selectedDate);
        defaultEnd.setHours(10, 0, 0, 0); // Set to 10:00 AM
        
        // Default reminder time: 30 minutes before event
        const defaultReminderTime = new Date(defaultStart);
        defaultReminderTime.setMinutes(defaultReminderTime.getMinutes() - 30);
        
        setFormData({
          title: '',
          user_surname: '',
          user_number: '',
          social_network_link: '',
          event_notes: '',
          start_date: defaultStart.toISOString(),
          end_date: defaultEnd.toISOString(),
          type: 'event',
          payment_status: 'not_paid',
          payment_amount: 0,
          email_reminder_enabled: false, // Default to false for new events
          reminder_at: defaultReminderTime.toISOString(),
        });
      }
    }
  }, [open, eventData, selectedDate]);

  const handleSave = async () => {
    try {
      setIsLoading(true);

      // Validation
      if (!formData.title?.trim() && !formData.user_surname?.trim()) {
        toast({
          title: "Error",
          description: "Please provide either a title or customer name",
          variant: "destructive",
        });
        return;
      }

      if (!formData.start_date || !formData.end_date) {
        toast({
          title: "Error",
          description: "Please select both start and end times",
          variant: "destructive",
        });
        return;
      }

      // Validate reminder time if enabled
      if (formData.email_reminder_enabled) {
        if (!formData.reminder_at) {
          toast({
            title: "Error",
            description: "Please set a reminder time when email reminder is enabled",
            variant: "destructive",
          });
          return;
        }

        const reminderTime = new Date(formData.reminder_at);
        const eventTime = new Date(formData.start_date);
        const now = new Date();

        if (reminderTime >= eventTime) {
          toast({
            title: "Error",
            description: "Reminder time must be before the event start time",
            variant: "destructive",
          });
          return;
        }

        if (reminderTime <= now) {
          toast({
            title: "Warning",
            description: "Reminder time is in the past. The reminder will not be sent.",
            variant: "destructive",
          });
          return;
        }
      }

      // Prepare the data for saving
      const dataToSave = {
        ...formData,
        title: formData.user_surname || formData.title || 'Untitled Event',
        // Only include reminder fields if reminder is enabled
        email_reminder_enabled: formData.email_reminder_enabled || false,
        reminder_at: formData.email_reminder_enabled ? formData.reminder_at : null,
      };

      console.log('Saving event data:', dataToSave);

      await onSave(dataToSave);
      handleClose();

      toast({
        title: "Success",
        description: `Event ${eventData ? 'updated' : 'created'} successfully${formData.email_reminder_enabled ? ' with email reminder' : ''}`,
      });

    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (deleteChoice?: "this" | "series") => {
    if (!eventData || !onDelete) return;

    try {
      setIsLoading(true);
      await onDelete(eventData.id, deleteChoice);
      handleClose();
      setIsRecurringDeleteOpen(false);
      
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (!eventData) return;

    // Check if this is a recurring event
    const isRecurring = eventData.is_recurring || eventData.parent_event_id;
    
    if (isRecurring) {
      // Show recurring delete dialog
      setIsRecurringDeleteOpen(true);
    } else {
      // For non-recurring events, delete immediately
      handleDelete();
    }
  };

  const handleDeleteThis = () => {
    handleDelete("this");
  };

  const handleDeleteSeries = () => {
    handleDelete("series");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNewEvent ? 'Add Event' : 'Edit Event'}
              {isBookingRequest && ' (Booking Request)'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <EventDialogFields
              formData={formData}
              setFormData={setFormData}
              isBookingRequest={isBookingRequest}
              isVirtualEvent={isVirtualEvent}
            />

            <div className="flex justify-between pt-4">
              <div className="flex gap-2">
                {eventData && onDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Event
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the event.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteClick}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : (isNewEvent ? 'Create Event' : 'Update Event')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recurring Delete Dialog */}
      <RecurringDeleteDialog
        open={isRecurringDeleteOpen}
        onOpenChange={setIsRecurringDeleteOpen}
        onDeleteThis={handleDeleteThis}
        onDeleteSeries={handleDeleteSeries}
        isRecurringEvent={!!(eventData?.is_recurring || eventData?.parent_event_id)}
      />
    </>
  );
};
