
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
            {isGroupEvent ? 'Group Event' : 'Individual Event'}
          </Label>
        </div>
      </div>

      {/* Event Type */}
      <div>
        <Label htmlFor="event-type">
          <LanguageText 
            en="Event Type" 
            ka="ღონისძიების ტიპი" 
            es="Tipo de Evento" 
          />
        </Label>
        <Select value={event.type} onValueChange={(value) => onUpdate({ type: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="birthday">
              <LanguageText en="Birthday" ka="დაბადების დღე" es="Cumpleaños" />
            </SelectItem>
            <SelectItem value="private_party">
              <LanguageText en="Private Party" ka="კერძო წვეულება" es="Fiesta Privada" />
            </SelectItem>
            <SelectItem value="wedding">
              <LanguageText en="Wedding" ka="ქორწილი" es="Boda" />
            </SelectItem>
            <SelectItem value="corporate">
              <LanguageText en="Corporate Event" ka="კორპორატიული ღონისძიება" es="Evento Corporativo" />
            </SelectItem>
            <SelectItem value="other">
              <LanguageText en="Other" ka="სხვა" es="Otro" />
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Group Name (for group events) */}
      {isGroupEvent && (
        <div>
          <Label htmlFor="group-name">
            <LanguageText 
              en="Group Name" 
              ka="ჯგუფის სახელი" 
              es="Nombre del Grupo" 
            />
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
              <LanguageText 
                en="Customer Name" 
                ka="კლიენტის სახელი" 
                es="Nombre del Cliente" 
              />
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
              <LanguageText 
                en="Customer Surname" 
                ka="კლიენტის გვარი" 
                es="Apellido del Cliente" 
              />
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
              <LanguageText 
                en="Phone Number" 
                ka="ტელეფონის ნომერი" 
                es="Número de Teléfono" 
              />
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
              <LanguageText 
                en="Email" 
                ka="ელ. ფოსტა" 
                es="Correo Electrónico" 
              />
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
          <LanguageText 
            en="Social Network Link" 
            ka="სოციალური ქსელის ლინკი" 
            es="Enlace de Red Social" 
          />
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
          <LanguageText 
            en="Event Notes" 
            ka="ღონისძიების ჩანაწერები" 
            es="Notas del Evento" 
          />
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
            <LanguageText 
              en="Payment Amount" 
              ka="გადასახდელი თანხა" 
              es="Monto de Pago" 
            />
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
            <LanguageText 
              en="Payment Status" 
              ka="გადახდის სტატუსი" 
              es="Estado de Pago" 
            />
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
                <LanguageText en="Not Paid" ka="არ არის გადახდილი" es="No Pagado" />
              </SelectItem>
              <SelectItem value="paid">
                <LanguageText en="Paid" ka="გადახდილი" es="Pagado" />
              </SelectItem>
              <SelectItem value="partial">
                <LanguageText en="Partial" ka="ნაწილობრივ" es="Parcial" />
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* File Upload */}
      {onFileSelect && (
        <div>
          <Label>
            <LanguageText 
              en="Attach File" 
              ka="ფაილის მიმაგრება" 
              es="Adjuntar Archivo" 
            />
          </Label>
          <FileUploadField onFileSelect={onFileSelect} />
        </div>
      )}
    </div>
  );
};
