import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
      ...(checked ? {
        // group mode: clear full name
        title: '',
      } : {
        group_name: '',
      })
    });
    if (!checked) setGroupMembers([]);
  };

  const handleGroupMembersChange = (members: GroupMember[]) => {
    setGroupMembers(members);
    onUpdate({ groupMembers: members } as any);
  };

  // Get payment status (for showing payment amount field)
  const paymentStatus = event.payment_status || 'not_paid';

  return (
    <div className="space-y-4">
      {/* Group Event Toggle */}
      <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
        <Switch
          id="group-event"
          checked={isGroupEvent}
          onCheckedChange={handleGroupToggle}
        />
        <div className="flex items-center">
          {isGroupEvent ? <Users className="w-4 h-4 mr-1" /> : <User className="w-4 h-4 mr-1" />}
          <Label htmlFor="group-event" className="font-medium">
            <LanguageText>
              {isGroupEvent ? 'Group Event' : 'Individual Event'}
            </LanguageText>
          </Label>
        </div>
      </div>
      {/* Group Name for group events */}
      {isGroupEvent && (
        <div>
          <Label htmlFor="group-name">
            <LanguageText>Group Name</LanguageText>
          </Label>
          <Input
            id="group-name"
            value={event.group_name || ''}
            onChange={e => onUpdate({ group_name: e.target.value })}
            placeholder="Enter group name"
          />
        </div>
      )}
      {/* Individual Event: One Full Name Field */}
      {!isGroupEvent && (
        <>
          <div>
            <Label htmlFor="full-name">
              <LanguageText>Full Name</LanguageText>
            </Label>
            <Input
              id="full-name"
              value={event.title || ''}
              onChange={e => onUpdate({ title: e.target.value })}
              placeholder="Full name"
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
              placeholder="Email"
            />
          </div>
        </>
      )}
      {/* Group Members for group events */}
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
      {/* Payment fields only for individual events */}
      {!isGroupEvent && (
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <Label htmlFor="payment-status">
              <LanguageText>Payment Status</LanguageText>
            </Label>
            <select 
              value={paymentStatus}
              onChange={(e) => onUpdate({ payment_status: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="not_paid">
                <LanguageText>Not Paid</LanguageText>
              </option>
              <option value="paid">
                <LanguageText>Paid</LanguageText>
              </option>
              <option value="partial">
                <LanguageText>Partial</LanguageText>
              </option>
            </select>
          </div>
          {/* Only show payment amount if status is NOT 'not_paid' */}
          {paymentStatus !== "not_paid" && (
            <div>
              <Label htmlFor="payment-amount">
                <LanguageText>Payment Amount</LanguageText>
              </Label>
              <Input
                id="payment-amount"
                type="number"
                value={event.payment_amount || ''}
                onChange={(e) => onUpdate({ payment_amount: parseFloat(e.target.value) || 0 })}
                placeholder="Amount"
                min={0}
              />
            </div>
          )}
        </div>
      )}
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
// Note: This file is over 200 lines long, consider asking me to refactor it into smaller focused components for easier maintainability.
