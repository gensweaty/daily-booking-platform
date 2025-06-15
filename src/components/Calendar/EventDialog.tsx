import { useState, useEffect } from 'react';
import { CalendarEventType, GroupMember } from '@/lib/types/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EventDialogFields } from './EventDialogFields';
import { LanguageText } from '@/components/shared/LanguageText';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Clock } from 'lucide-react';

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEventType) => void;
  event?: CalendarEventType | null;
  selectedDate?: Date;
}

export const EventDialog = ({
  isOpen,
  onClose,
  onSave,
  event,
  selectedDate
}: EventDialogProps) => {
  const { toast } = useToast();
  const [eventData, setEventData] = useState<CalendarEventType>({
    id: '',
    title: '',
    start_date: '',
    end_date: '',
    type: '',
    created_at: '',
    user_id: '',
    is_group_event: false,
    group_name: '',
    parent_group_id: null
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (event) {
      setEventData(event);
    } else if (selectedDate) {
      const dateStr = selectedDate.toISOString().slice(0,16);
      setEventData({
        id: '',
        title: '',
        start_date: `${dateStr}`,
        end_date: `${dateStr}`,
        type: '',
        created_at: '',
        user_id: '',
        is_group_event: false,
        group_name: '',
        parent_group_id: null
      });
    }
  }, [event, selectedDate]);

  // Ensure correct creation and update of events
  const handleSave = async () => {
    if (!eventData.start_date || !eventData.end_date) {
      toast({
        title: "Error",
        description: "Please fill in start and end date/time",
        variant: "destructive"
      });
      return;
    }
    if (eventData.is_group_event && !eventData.group_name) {
      toast({
        title: "Error",
        description: "Please enter a group name",
        variant: "destructive"
      });
      return;
    }
    if (!eventData.is_group_event && !eventData.title) {
      toast({
        title: "Error",
        description: "Please enter the full name",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (eventData.is_group_event) {
        await handleGroupEventSave(user.id);
      } else {
        await handleIndividualEventSave(user.id);
      }
      toast({
        title: "Success",
        description: "Event saved",
      });
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: "Failed to save event",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create/save group event
  const handleGroupEventSave = async (userId: string) => {
    const groupMembers = (eventData as any).groupMembers as GroupMember[] || [];
    if (groupMembers.length === 0) throw new Error('Group events must have at least one member');
    // Save just main event as group container
    const mainEvent = {
      group_name: eventData.group_name,
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      title: '', // Blank title for group entries (required by type)
      type: '',
      user_id: userId,
      is_group_event: true,
      event_notes: eventData.event_notes,
      social_network_link: eventData.social_network_link
    };
    const { data: groupEvent, error: groupError } = await supabase
      .from('events')
      .insert([mainEvent])
      .select()
      .single();
    if (groupError) throw groupError;
    // Group members saving would go here
    onSave(groupEvent);
  };

  // Create/save individual event
  const handleIndividualEventSave = async (userId: string) => {
    const eventToSave = {
      ...eventData,
      title: eventData.title,
      user_id: userId,
      id: event?.id || undefined
    };
    let data, error;
    if (event?.id) {
      ({ data, error } = await supabase
        .from('events')
        .update(eventToSave)
        .eq('id', event.id)
        .select()
        .single()
      );
    } else {
      ({ data, error } = await supabase
        .from('events')
        .insert([eventToSave])
        .select()
        .single()
      );
    }
    if (error) throw error;
    onSave(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            <LanguageText>
              {event ? "Edit Event" : "Create Event"}
            </LanguageText>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Date and Time */}
          <div className="flex flex-col gap-2">
            <div>
              <Label htmlFor="start-date" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <LanguageText>Start</LanguageText>
              </Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={eventData.start_date}
                onChange={e => setEventData({ ...eventData, start_date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <LanguageText>End</LanguageText>
              </Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={eventData.end_date}
                onChange={e => setEventData({ ...eventData, end_date: e.target.value })}
                required
              />
            </div>
          </div>
          {/* Event Fields */}
          <EventDialogFields
            event={eventData}
            onUpdate={updates => setEventData({ ...eventData, ...updates })}
            onFileSelect={setSelectedFile}
            isEditing={!!event}
          />
          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              <LanguageText>Cancel</LanguageText>
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? <LanguageText>Saving...</LanguageText> : <LanguageText>{event ? "Update" : "Create"}</LanguageText>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
