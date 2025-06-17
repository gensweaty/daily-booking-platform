
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Save, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currency";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGroupMembers } from "./hooks/useGroupMembers";

export interface GroupMember {
  id: string;
  user_surname: string;
  user_number: string;
  social_network_link: string;
  event_notes: string;
  payment_status: string;
  payment_amount: string;
}

interface GroupMembersFieldProps {
  groupMembers: GroupMember[];
  setGroupMembers: (members: GroupMember[]) => void;
  disabled?: boolean;
  eventId?: string;
  startDate?: string;
  endDate?: string;
}

export const GroupMembersField = ({ 
  groupMembers, 
  setGroupMembers, 
  disabled = false,
  eventId,
  startDate,
  endDate
}: GroupMembersFieldProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);
  const { saveMember, deleteMember, isLoading } = useGroupMembers(eventId);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState<string | null>(null);

  const addGroupMember = () => {
    const newMember: GroupMember = {
      id: crypto.randomUUID(),
      user_surname: "",
      user_number: "",
      social_network_link: "",
      event_notes: "",
      payment_status: "not_paid",
      payment_amount: ""
    };
    setGroupMembers([...groupMembers, newMember]);
  };

  const removeGroupMember = (id: string) => {
    setGroupMembers(groupMembers.filter(member => member.id !== id));
  };

  const updateGroupMember = (id: string, field: keyof GroupMember, value: string) => {
    setGroupMembers(groupMembers.map(member => 
      member.id === id ? { ...member, [field]: value } : member
    ));
  };

  const handleSaveMember = async (member: GroupMember) => {
    if (!eventId || !startDate || !endDate) return;
    
    setSavingMember(member.id);
    const success = await saveMember(member, eventId, startDate, endDate);
    setSavingMember(null);
    
    // Don't need to update state here as the member is already in the list
  };

  const handleDeleteMember = async (memberId: string) => {
    const success = await deleteMember(memberId);
    if (success) {
      removeGroupMember(memberId);
    }
    setMemberToDelete(null);
  };

  const isMemberValid = (member: GroupMember) => {
    return member.user_surname.trim().length > 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className={cn("text-sm font-medium", isGeorgian ? "font-georgian" : "")}>
            {t("events.groupMembers")}
          </Label>
          {groupMembers.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("events.memberCount", { count: groupMembers.length })}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addGroupMember}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("events.addMember")}
        </Button>
      </div>

      {groupMembers.length === 0 && (
        <p className={cn("text-sm text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
          {t("events.noMembersYet")}
        </p>
      )}

      {groupMembers.map((member, index) => (
        <div key={member.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className={cn("font-medium", isGeorgian ? "font-georgian" : "")}>
              {t("events.member")} {index + 1}
            </h4>
            <div className="flex gap-2">
              {eventId && startDate && endDate && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => handleSaveMember(member)}
                  disabled={disabled || !isMemberValid(member) || savingMember === member.id}
                  className="flex items-center gap-2"
                >
                  {savingMember === member.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t("events.saveMember")}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMemberToDelete(member.id)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`member-name-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.fullName")} *
              </Label>
              <Input
                id={`member-name-${member.id}`}
                value={member.user_surname}
                onChange={(e) => updateGroupMember(member.id, 'user_surname', e.target.value)}
                disabled={disabled}
                className={cn(isGeorgian ? "font-georgian" : "")}
                placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")}
                required
              />
            </div>

            <div>
              <Label htmlFor={`member-phone-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.phoneNumber")}
              </Label>
              <Input
                id={`member-phone-${member.id}`}
                value={member.user_number}
                onChange={(e) => updateGroupMember(member.id, 'user_number', e.target.value)}
                disabled={disabled}
                className={cn(isGeorgian ? "font-georgian" : "")}
                placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
              />
            </div>

            <div>
              <Label htmlFor={`member-email-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.socialLinkEmail")}
              </Label>
              <Input
                id={`member-email-${member.id}`}
                type="email"
                value={member.social_network_link}
                onChange={(e) => updateGroupMember(member.id, 'social_network_link', e.target.value)}
                disabled={disabled}
                className={cn(isGeorgian ? "font-georgian" : "")}
                placeholder="email@example.com"
              />
            </div>

            <div>
              <Label htmlFor={`member-payment-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.paymentStatus")}
              </Label>
              <Select
                value={member.payment_status}
                onValueChange={(value) => updateGroupMember(member.id, 'payment_status', value)}
                disabled={disabled}
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

            {(member.payment_status === "partly_paid" || member.payment_status === "fully_paid") && (
              <div className="md:col-span-2">
                <Label htmlFor={`member-amount-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")}>
                  {t("events.paymentAmount")}
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-gray-500">{currencySymbol}</span>
                  </div>
                  <Input
                    id={`member-amount-${member.id}`}
                    type="text"
                    inputMode="decimal"
                    value={member.payment_amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        updateGroupMember(member.id, 'payment_amount', value);
                      }
                    }}
                    disabled={disabled}
                    className={cn("pl-7", isGeorgian ? "font-georgian" : "")}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <Label htmlFor={`member-notes-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.eventNotes")}
              </Label>
              <Textarea
                id={`member-notes-${member.id}`}
                value={member.event_notes}
                onChange={(e) => updateGroupMember(member.id, 'event_notes', e.target.value)}
                disabled={disabled}
                className={cn(isGeorgian ? "font-georgian" : "")}
                rows={2}
                placeholder={isGeorgian ? "დაამატეთ შენიშვნები ამ წევრის შესახებ" : "Add notes about this member"}
              />
            </div>
          </div>

          {!isMemberValid(member) && (
            <p className="text-sm text-destructive">
              {t("events.fullName")} is required to save this member
            </p>
          )}
        </div>
      ))}

      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("events.deleteMember")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("events.confirmDeleteMember")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToDelete && handleDeleteMember(memberToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
