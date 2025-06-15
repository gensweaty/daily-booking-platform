import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, User } from 'lucide-react';
import { GroupMember } from '@/lib/types/calendar';

interface GroupMembersManagerProps {
  members: GroupMember[];
  onMembersChange: (members: GroupMember[]) => void;
}

export const GroupMembersManager = ({ members, onMembersChange }: GroupMembersManagerProps) => {
  const [newMember, setNewMember] = useState<GroupMember>({
    name: '',
    surname: '',
    phone: '',
    email: '',
    notes: '',
    social_network_link: '',
    payment_amount: 0,
    payment_status: 'not_paid'
  });

  const addMember = () => {
    if (newMember.name.trim()) {
      onMembersChange([...members, { ...newMember, id: crypto.randomUUID() }]);
      setNewMember({
        name: '',
        surname: '',
        phone: '',
        email: '',
        notes: '',
        social_network_link: '',
        payment_amount: 0,
        payment_status: 'not_paid'
      });
    }
  };

  const removeMember = (index: number) => {
    const updatedMembers = members.filter((_, i) => i !== index);
    onMembersChange(updatedMembers);
  };

  const updateMember = (index: number, field: keyof GroupMember, value: string | number) => {
    const updatedMembers = members.map((member, i) => 
      i === index ? { ...member, [field]: value } : member
    );
    onMembersChange(updatedMembers);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-4 h-4" />
        <h3 className="text-lg font-semibold">Group Members ({members.length})</h3>
      </div>

      {/* Existing Members */}
      {members.map((member, index) => (
        <Card key={member.id || index} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Member {index + 1}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeMember(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`member-name-${index}`}>Name *</Label>
              <Input
                id={`member-name-${index}`}
                value={member.name}
                onChange={(e) => updateMember(index, 'name', e.target.value)}
                placeholder="First name"
              />
            </div>
            <div>
              <Label htmlFor={`member-surname-${index}`}>Surname</Label>
              <Input
                id={`member-surname-${index}`}
                value={member.surname || ''}
                onChange={(e) => updateMember(index, 'surname', e.target.value)}
                placeholder="Last name"
              />
            </div>
            <div>
              <Label htmlFor={`member-phone-${index}`}>Phone</Label>
              <Input
                id={`member-phone-${index}`}
                value={member.phone || ''}
                onChange={(e) => updateMember(index, 'phone', e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label htmlFor={`member-email-${index}`}>Email</Label>
              <Input
                id={`member-email-${index}`}
                type="email"
                value={member.email || ''}
                onChange={(e) => updateMember(index, 'email', e.target.value)}
                placeholder="Email address"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={`member-notes-${index}`}>Notes</Label>
              <Textarea
                id={`member-notes-${index}`}
                value={member.notes || ''}
                onChange={(e) => updateMember(index, 'notes', e.target.value)}
                placeholder="Individual notes for this member"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add New Member Form */}
      <Card className="border-2 border-dashed border-gray-300">
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">Add New Member</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="new-member-name">Name *</Label>
            <Input
              id="new-member-name"
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              placeholder="First name"
            />
          </div>
          <div>
            <Label htmlFor="new-member-surname">Surname</Label>
            <Input
              id="new-member-surname"
              value={newMember.surname}
              onChange={(e) => setNewMember({ ...newMember, surname: e.target.value })}
              placeholder="Last name"
            />
          </div>
          <div>
            <Label htmlFor="new-member-phone">Phone</Label>
            <Input
              id="new-member-phone"
              value={newMember.phone}
              onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>
          <div>
            <Label htmlFor="new-member-email">Email</Label>
            <Input
              id="new-member-email"
              type="email"
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              placeholder="Email address"
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="new-member-notes">Notes</Label>
            <Textarea
              id="new-member-notes"
              value={newMember.notes}
              onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })}
              placeholder="Individual notes for this member"
              rows={2}
            />
          </div>
          <div className="col-span-2">
            <Button 
              onClick={addMember} 
              disabled={!newMember.name.trim()}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
