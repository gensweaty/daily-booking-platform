
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
    type: 'private_party',
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
      const dateStr = selectedDate.toISOString().split('T')[0];
      setEventData({
        id: '',
        title: '',
        start_date: `${dateStr}T10:00`,
        end_date: `${dateStr}T12:00`,
        type: 'private_party',
        created_at: '',
        user_id: '',
        is_group_event: false,
        group_name: '',
        parent_group_id: null
      });
    }
  }, [event, selectedDate]);

  const handleSave = async () => {
    if (!eventData.start_date || !eventData.end_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
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
        description: "Please enter a customer name",
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
        description: eventData.is_group_event 
          ? "Group event created successfully" 
          : "Event saved successfully"
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

  const handleGroupEventSave = async (userId: string) => {
    const groupMembers = (eventData as any).groupMembers as GroupMember[] || [];
    
    if (groupMembers.length === 0) {
      throw new Error('Group events must have at least one member');
    }

    // Create main group event
    const mainEvent = {
      title: eventData.group_name,
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      type: eventData.type,
      user_id: userId,
      is_group_event: true,
      group_name: eventData.group_name,
      event_notes: eventData.event_notes,
      social_network_link: eventData.social_network_link
    };

    const { data: groupEvent, error: groupError } = await supabase
      .from('events')
      .insert([mainEvent])
      .select()
      .single();

    if (groupError) throw groupError;

    // Create individual member events and customers
    for (const member of groupMembers) {
      // Create customer record
      const customerData = {
        title: member.name,
        user_surname: member.surname,
        user_number: member.phone,
        user_id: userId,
        type: eventData.type,
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        event_notes: member.notes,
        social_network_link: member.social_network_link,
        payment_amount: member.payment_amount,
        payment_status: member.payment_status,
        parent_group_id: groupEvent.id,
        is_group_member: true,
        create_event: true
      };

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (customerError) throw customerError;

      // Create individual member event
      const memberEvent = {
        title: member.name,
        user_surname: member.surname,
        user_number: member.phone,
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        type: eventData.type,
        user_id: userId,
        parent_group_id: groupEvent.id,
        customer_id: customer.id,
        event_notes: member.notes,
        social_network_link: member.social_network_link,
        payment_amount: member.payment_amount,
        payment_status: member.payment_status,
        requester_email: member.email
      };

      const { error: memberError } = await supabase
        .from('events')
        .insert([memberEvent]);

      if (memberError) throw memberError;
    }

    onSave(groupEvent);
  };

  const handleIndividualEventSave = async (userId: string) => {
    // Create customer record first
    const customerData = {
      title: eventData.title,
      user_surname: eventData.user_surname,
      user_number: eventData.user_number,
      user_id: userId,
      type: eventData.type,
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      event_notes: eventData.event_notes,
      social_network_link: eventData.social_network_link,
      payment_amount: eventData.payment_amount,
      payment_status: eventData.payment_status,
      create_event: true
    };

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert([customerData])
      .select()
      .single();

    if (customerError) throw customerError;

    // Create event
    const eventToSave = {
      ...eventData,
      user_id: userId,
      customer_id: customer.id,
      id: event?.id || undefined
    };

    if (event?.id) {
      const { data, error } = await supabase
        .from('events')
        .update(eventToSave)
        .eq('id', event.id)
        .select()
        .single();

      if (error) throw error;
      onSave(data);
    } else {
      const { data, error } = await supabase
        .from('events')
        .insert([eventToSave])
        .select()
        .single();

      if (error) throw error;
      onSave(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            <LanguageText>
              {event ? "Edit Event" : "Create New Event"}
            </LanguageText>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date and Time Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <LanguageText>Start Date & Time</LanguageText>
              </Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={eventData.start_date}
                onChange={(e) => setEventData({ ...eventData, start_date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="end-date" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <LanguageText>End Date & Time</LanguageText>
              </Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={eventData.end_date}
                onChange={(e) => setEventData({ ...eventData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Event Fields */}
          <EventDialogFields
            event={eventData}
            onUpdate={(updates) => setEventData({ ...eventData, ...updates })}
            onFileSelect={setSelectedFile}
            isEditing={!!event}
          />

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              <LanguageText>Cancel</LanguageText>
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <LanguageText>Saving...</LanguageText>
              ) : (
                <LanguageText>
                  {event ? "Update Event" : "Create Event"}
                </LanguageText>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
