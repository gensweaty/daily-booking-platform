
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GroupMember } from "@/lib/types/calendar";
import { cn } from "@/lib/utils";

interface GroupParticipantsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: GroupMember[];
  onMembersChange: (members: GroupMember[]) => void;
}

export const GroupParticipants = ({ 
  open, 
  onOpenChange, 
  members, 
  onMembersChange 
}: GroupParticipantsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const [currentMember, setCurrentMember] = useState<GroupMember>({
    full_name: '',
    email: '',
    phone: '',
    payment_status: 'not_paid',
    notes: ''
  });

  const addMember = () => {
    if (!currentMember.full_name.trim() || !currentMember.email.trim()) {
      return;
    }
    
    const newMember = {
      ...currentMember,
      id: crypto.randomUUID()
    };
    
    onMembersChange([...members, newMember]);
    
    // Reset form
    setCurrentMember({
      full_name: '',
      email: '',
      phone: '',
      payment_status: 'not_paid',
      notes: ''
    });
  };

  const removeMember = (id: string) => {
    onMembersChange(members.filter(member => member.id !== id));
  };

  const updateMember = (id: string, updates: Partial<GroupMember>) => {
    onMembersChange(members.map(member => 
      member.id === id ? { ...member, ...updates } : member
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isGeorgian ? "font-georgian" : "")}>
            <Users className="h-5 w-5" />
            {t("events.groupMembers")}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Add new member form */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className={cn("font-medium mb-4", isGeorgian ? "font-georgian" : "")}>
              {t("events.addNewMember")}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="member-name">{t("events.fullName")} *</Label>
                <Input
                  id="member-name"
                  value={currentMember.full_name}
                  onChange={(e) => setCurrentMember(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder={t("events.enterFullName")}
                />
              </div>
              
              <div>
                <Label htmlFor="member-email">{t("events.email")} *</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={currentMember.email}
                  onChange={(e) => setCurrentMember(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={t("events.enterEmail")}
                />
              </div>
              
              <div>
                <Label htmlFor="member-phone">{t("events.phone")}</Label>
                <Input
                  id="member-phone"
                  value={currentMember.phone}
                  onChange={(e) => setCurrentMember(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder={t("events.enterPhone")}
                />
              </div>
              
              <div>
                <Label htmlFor="member-payment">{t("events.paymentStatus")}</Label>
                <Select
                  value={currentMember.payment_status}
                  onValueChange={(value) => setCurrentMember(prev => ({ ...prev, payment_status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
                    <SelectItem value="partly_paid">{t("events.partlyPaid")}</SelectItem>
                    <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-4">
              <Label htmlFor="member-notes">{t("events.notes")}</Label>
              <Textarea
                id="member-notes"
                value={currentMember.notes}
                onChange={(e) => setCurrentMember(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t("events.enterNotes")}
                rows={2}
              />
            </div>
            
            <Button
              onClick={addMember}
              className="mt-4"
              disabled={!currentMember.full_name.trim() || !currentMember.email.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("events.addMember")}
            </Button>
          </div>
          
          {/* Members list */}
          {members.length > 0 && (
            <div>
              <h3 className={cn("font-medium mb-4", isGeorgian ? "font-georgian" : "")}>
                {t("events.groupMembersList")} ({members.length})
              </h3>
              
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="font-medium">{member.full_name}</span>
                          <div className="text-gray-600">{member.email}</div>
                        </div>
                        <div>
                          {member.phone && <div>{member.phone}</div>}
                          <div className="text-gray-600">
                            {t(`events.${member.payment_status || 'not_paid'}`)}
                          </div>
                        </div>
                        <div className="text-gray-600">
                          {member.notes && <div className="truncate">{member.notes}</div>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(member.id!)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              {t("common.done")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
