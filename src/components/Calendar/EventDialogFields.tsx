
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarEventType, GroupMember } from '@/lib/types/calendar';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { LanguageText } from '@/components/shared/LanguageText';
import { GroupMembersManager } from './GroupMembersManager';
import { Users, User } from 'lucide-react';

interface EventDialogFieldsProps {
  event: CalendarEventType;
  onUpdate: (updates: Partial<CalendarEventType>) => void;
  onFileSelect?: (file: File | null) => void;
  isEditing?: boolean;
}

export const EventDialogFields = ({
  event,
  onUpdate,
  onFileSelect,
  isEditing = false
}: EventDialogFieldsProps) => {
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isGroupEvent, setIsGroupEvent] = useState(event.is_group_event || false);

  useEffect(() => {
    setIsGroupEvent(event.is_group_event || false);
  }, [event.is_group_event]);

  const handleGroupToggle = (checked: boolean) => {
    setIsGroupEvent(checked);
    onUpdate({ 
      is_group_event: checked,
      // Clear individual fields when switching to group mode
      ...(checked ? {
        title: '',
        user_surname: '',
        user_number: '',
        requester_name: '',
        requester_email: '',
        requester_phone: ''
      } : {
        group_name: '',
      })
    });
    
    if (!checked) {
      setGroupMembers([]);
    }
  };

  const handleGroupMembersChange = (members: GroupMember[]) => {
    setGroupMembers(members);
    // Store group members data in a way that can be processed later
    onUpdate({ groupMembers: members } as any);
  };

  return (
    <div className="space-y-4">
      {/* Group Event Toggle */}
      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
        <Switch
          id="group-event"
          checked={isGroupEvent}
          onCheckedChange={handleGroupToggle}
        />
        <div className="flex items-center gap-2">
          {isGroupEvent ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
          <Label htmlFor="group-event" className="font-medium">
            <LanguageText>
              {isGroupEvent ? 'Group Event' : 'Individual Event'}
            </LanguageText>
          </Label>
        </div>
      </div>

      {/* Event Type */}
      <div>
        <Label htmlFor="event-type">
          <LanguageText>Event Type</LanguageText>
        </Label>
        <Select value={event.type} onValueChange={(value) => onUpdate({ type: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="birthday">
              <LanguageText>Birthday</LanguageText>
            </SelectItem>
            <SelectItem value="private_party">
              <LanguageText>Private Party</LanguageText>
            </SelectItem>
            <SelectItem value="wedding">
              <LanguageText>Wedding</LanguageText>
            </SelectItem>
            <SelectItem value="corporate">
              <LanguageText>Corporate Event</LanguageText>
            </SelectItem>
            <SelectItem value="other">
              <LanguageText>Other</LanguageText>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Group Name (for group events) */}
      {isGroupEvent && (
        <div>
          <Label htmlFor="group-name">
            <LanguageText>Group Name</LanguageText>
          </Label>
          <Input
            id="group-name"
            value={event.group_name || ''}
            onChange={(e) => onUpdate({ group_name: e.target.value })}
            placeholder="Enter group name"
          />
        </div>
      )}

      {/* Individual Event Fields */}
      {!isGroupEvent && (
        <>
          <div>
            <Label htmlFor="event-title">
              <LanguageText>Customer Name</LanguageText>
            </Label>
            <Input
              id="event-title"
              value={event.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Customer name"
            />
          </div>

          <div>
            <Label htmlFor="user-surname">
              <LanguageText>Customer Surname</LanguageText>
            </Label>
            <Input
              id="user-surname"
              value={event.user_surname || ''}
              onChange={(e) => onUpdate({ user_surname: e.target.value })}
              placeholder="Customer surname"
            />
          </div>

          <div>
            <Label htmlFor="user-number">
              <LanguageText>Phone Number</LanguageText>
            </Label>
            <Input
              id="user-number"
              value={event.user_number || ''}
              onChange={(e) => onUpdate({ user_number: e.target.value })}
              placeholder="Phone number"
            />
          </div>

          <div>
            <Label htmlFor="requester-email">
              <LanguageText>Email</LanguageText>
            </Label>
            <Input
              id="requester-email"
              type="email"
              value={event.requester_email || ''}
              onChange={(e) => onUpdate({ requester_email: e.target.value })}
              placeholder="Email address"
            />
          </div>
        </>
      )}

      {/* Group Members Manager (for group events) */}
      {isGroupEvent && (
        <GroupMembersManager
          members={groupMembers}
          onMembersChange={handleGroupMembersChange}
        />
      )}

      {/* Common Fields */}
      <div>
        <Label htmlFor="social-link">
          <LanguageText>Social Network Link</LanguageText>
        </Label>
        <Input
          id="social-link"
          value={event.social_network_link || ''}
          onChange={(e) => onUpdate({ social_network_link: e.target.value })}
          placeholder="Social media profile"
        />
      </div>

      <div>
        <Label htmlFor="event-notes">
          <LanguageText>Event Notes</LanguageText>
        </Label>
        <Textarea
          id="event-notes"
          value={event.event_notes || ''}
          onChange={(e) => onUpdate({ event_notes: e.target.value })}
          placeholder={isGroupEvent ? "General notes for the group event" : "Event notes"}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment-amount">
            <LanguageText>Payment Amount</LanguageText>
          </Label>
          <Input
            id="payment-amount"
            type="number"
            value={event.payment_amount || ''}
            onChange={(e) => onUpdate({ payment_amount: parseFloat(e.target.value) || 0 })}
            placeholder={isGroupEvent ? "Total amount" : "Amount"}
          />
        </div>

        <div>
          <Label htmlFor="payment-status">
            <LanguageText>Payment Status</LanguageText>
          </Label>
          <Select 
            value={event.payment_status || 'not_paid'} 
            onValueChange={(value) => onUpdate({ payment_status: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">
                <LanguageText>Not Paid</LanguageText>
              </SelectItem>
              <SelectItem value="paid">
                <LanguageText>Paid</LanguageText>
              </SelectItem>
              <SelectItem value="partial">
                <LanguageText>Partial</LanguageText>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* File Upload */}
      {onFileSelect && (
        <div>
          <Label>
            <LanguageText>Attach File</LanguageText>
          </Label>
          <FileUploadField onFileSelect={onFileSelect} />
        </div>
      )}
    </div>
  );
};
