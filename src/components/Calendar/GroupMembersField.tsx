
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currency";

export interface GroupMember {
  id?: string;
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
  eventId?: string;
  startDate: string;
  endDate: string;
}

export const GroupMembersField = ({
  groupMembers,
  setGroupMembers,
  eventId,
  startDate,
  endDate,
}: GroupMembersFieldProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);

  const addMember = () => {
    const newMember: GroupMember = {
      user_surname: "",
      user_number: "",
      social_network_link: "",
      event_notes: "",
      payment_status: "not_paid",
      payment_amount: "",
    };
    setGroupMembers([...groupMembers, newMember]);
  };

  const updateMember = (index: number, field: keyof GroupMember, value: string) => {
    const updatedMembers = [...groupMembers];
    updatedMembers[index] = { ...updatedMembers[index], [field]: value };
    setGroupMembers(updatedMembers);
  };

  const removeMember = (index: number) => {
    const updatedMembers = groupMembers.filter((_, i) => i !== index);
    setGroupMembers(updatedMembers);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className={cn("text-lg font-semibold", isGeorgian ? "font-georgian" : "")}>
          <Users className="w-5 h-5 inline mr-2" />
          {t("events.groupMembers")} ({groupMembers.length})
        </Label>
        <Button type="button" onClick={addMember} size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          {t("events.addMember")}
        </Button>
      </div>

      {groupMembers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.noMembersYet")}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {groupMembers.map((member, index) => (
          <Card key={index} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={cn("text-sm", isGeorgian ? "font-georgian" : "")}>
                  {t("events.member")} {index + 1}
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className={cn(isGeorgian ? "font-georgian" : "")}>
                    {t("events.fullName")}
                  </Label>
                  <Input
                    value={member.user_surname}
                    onChange={(e) => updateMember(index, "user_surname", e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")}
                  />
                </div>

                <div>
                  <Label className={cn(isGeorgian ? "font-georgian" : "")}>
                    {t("events.phoneNumber")}
                  </Label>
                  <Input
                    value={member.user_number}
                    onChange={(e) => updateMember(index, "user_number", e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className={cn(isGeorgian ? "font-georgian" : "")}>
                    {t("events.socialLinkEmail")}
                  </Label>
                  <Input
                    type="email"
                    value={member.social_network_link}
                    onChange={(e) => updateMember(index, "social_network_link", e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <Label className={cn(isGeorgian ? "font-georgian" : "")}>
                    {t("events.paymentStatus")}
                  </Label>
                  <Select
                    value={member.payment_status}
                    onValueChange={(value) => updateMember(index, "payment_status", value)}
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

              {(member.payment_status === "partly_paid" || member.payment_status === "fully_paid") && (
                <div>
                  <Label className={cn(isGeorgian ? "font-georgian" : "")}>
                    {t("events.paymentAmount")}
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-gray-500">{currencySymbol}</span>
                    </div>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={member.payment_amount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                          updateMember(index, "payment_amount", value);
                        }
                      }}
                      className={cn("pl-7", isGeorgian ? "font-georgian" : "")}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label className={cn(isGeorgian ? "font-georgian" : "")}>
                  {t("events.eventNotes")}
                </Label>
                <Textarea
                  value={member.event_notes}
                  onChange={(e) => updateMember(index, "event_notes", e.target.value)}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  rows={2}
                  placeholder={isGeorgian ? "შენიშვნები" : "Notes"}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
