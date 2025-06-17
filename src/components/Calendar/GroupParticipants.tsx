
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GroupMember } from "@/lib/types/calendar";
import { cn } from "@/lib/utils";

interface GroupParticipantsProps {
  members: GroupMember[];
  onMembersChange: (members: GroupMember[]) => void;
}

export const GroupParticipants = ({ members, onMembersChange }: GroupParticipantsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentMember, setCurrentMember] = useState<GroupMember>({
    full_name: '',
    email: '',
    phone: '',
    payment_status: 'not_paid',
    notes: ''
  });

  const handleAddMember = () => {
    if (currentMember.full_name && currentMember.email) {
      const newMember = { ...currentMember, id: crypto.randomUUID() };
      onMembersChange([...members, newMember]);
      setCurrentMember({
        full_name: '',
        email: '',
        phone: '',
        payment_status: 'not_paid',
        notes: ''
      });
      setIsDialogOpen(false);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    onMembersChange(members.filter(member => member.id !== memberId));
  };

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className={cn("text-sm font-medium", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          Group Members ({members.length})
        </Label>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                Add Group Member
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="member-name" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  Full Name *
                </Label>
                <Input
                  id="member-name"
                  value={currentMember.full_name}
                  onChange={(e) => setCurrentMember({ ...currentMember, full_name: e.target.value })}
                  placeholder="Enter full name"
                  required
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                />
              </div>
              <div>
                <Label htmlFor="member-email" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  Email *
                </Label>
                <Input
                  id="member-email"
                  type="email"
                  value={currentMember.email}
                  onChange={(e) => setCurrentMember({ ...currentMember, email: e.target.value })}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div>
                <Label htmlFor="member-phone" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  Phone
                </Label>
                <Input
                  id="member-phone"
                  value={currentMember.phone}
                  onChange={(e) => setCurrentMember({ ...currentMember, phone: e.target.value })}
                  placeholder="Enter phone number"
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                />
              </div>
              <div>
                <Label htmlFor="member-payment" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  Payment Status
                </Label>
                <Select 
                  value={currentMember.payment_status} 
                  onValueChange={(value: 'not_paid' | 'partly_paid' | 'fully_paid') => 
                    setCurrentMember({ ...currentMember, payment_status: value })
                  }
                >
                  <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_paid">Not Paid</SelectItem>
                    <SelectItem value="partly_paid">Partly Paid</SelectItem>
                    <SelectItem value="fully_paid">Fully Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="member-notes" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  Notes
                </Label>
                <Textarea
                  id="member-notes"
                  value={currentMember.notes}
                  onChange={(e) => setCurrentMember({ ...currentMember, notes: e.target.value })}
                  placeholder="Additional notes"
                  className={cn("min-h-[60px] resize-none", isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={handleAddMember} className="flex-1">
                  Add Member
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {members.length > 0 && (
        <div className="space-y-2">
          {members.map((member) => (
            <Card key={member.id} className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className={cn("font-medium truncate", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {member.full_name}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{member.email}</div>
                    {member.phone && <div>{member.phone}</div>}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        member.payment_status === 'fully_paid' 
                          ? 'bg-green-100 text-green-800' 
                          : member.payment_status === 'partly_paid'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.payment_status === 'fully_paid' ? 'Fully Paid' : 
                         member.payment_status === 'partly_paid' ? 'Partly Paid' : 'Not Paid'}
                      </span>
                    </div>
                    {member.notes && (
                      <div className="text-xs italic">{member.notes}</div>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveMember(member.id!)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
