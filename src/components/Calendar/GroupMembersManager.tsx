
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";

export interface GroupMember {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  paymentStatus: string;
  paymentAmount: string;
  notes: string;
}

interface GroupMembersManagerProps {
  members: GroupMember[];
  onMembersChange: (members: GroupMember[]) => void;
}

export const GroupMembersManager = ({ members, onMembersChange }: GroupMembersManagerProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  const addMember = () => {
    const newMember: GroupMember = {
      id: crypto.randomUUID(),
      fullName: "",
      email: "",
      phoneNumber: "",
      paymentStatus: "not_paid",
      paymentAmount: "",
      notes: ""
    };
    onMembersChange([...members, newMember]);
  };

  const removeMember = (id: string) => {
    onMembersChange(members.filter(member => member.id !== id));
  };

  const updateMember = (id: string, field: keyof GroupMember, value: string) => {
    onMembersChange(
      members.map(member =>
        member.id === id ? { ...member, [field]: value } : member
      )
    );
  };

  const renderGeorgianLabel = (text: string) => {
    if (isGeorgian) {
      if (text === "events.fullName") return <GeorgianAuthText letterSpacing="-0.05px">სრული სახელი</GeorgianAuthText>;
      if (text === "events.phoneNumber") return <GeorgianAuthText letterSpacing="-0.05px">ტელეფონის ნომერი</GeorgianAuthText>;
      if (text === "events.socialLinkEmail") return <GeorgianAuthText letterSpacing="-0.05px">ელფოსტა</GeorgianAuthText>;
      if (text === "events.eventNotes") return <GeorgianAuthText letterSpacing="-0.05px">შენიშვნები</GeorgianAuthText>;
    }
    return <LanguageText>{t(text)}</LanguageText>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          <LanguageText>{t("events.groupMembers")}</LanguageText>
        </Label>
        <Button type="button" onClick={addMember} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          <LanguageText>{t("events.addMember")}</LanguageText>
        </Button>
      </div>

      {members.map((member, index) => (
        <Card key={member.id}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className={cn("text-base", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                <LanguageText>{t("events.member")}</LanguageText> {index + 1}
              </CardTitle>
              {members.length > 1 && (
                <Button
                  type="button"
                  onClick={() => removeMember(member.id)}
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor={`fullName-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {renderGeorgianLabel("events.fullName")}
              </Label>
              <Input
                id={`fullName-${member.id}`}
                value={member.fullName}
                onChange={(e) => updateMember(member.id, "fullName", e.target.value)}
                placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")}
                required
                className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
                style={georgianStyle}
              />
            </div>

            <div>
              <Label htmlFor={`email-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {renderGeorgianLabel("events.socialLinkEmail")}
              </Label>
              <Input
                id={`email-${member.id}`}
                type="email"
                value={member.email}
                onChange={(e) => updateMember(member.id, "email", e.target.value)}
                placeholder="email@example.com"
                style={georgianStyle}
              />
            </div>

            <div>
              <Label htmlFor={`phone-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {renderGeorgianLabel("events.phoneNumber")}
              </Label>
              <Input
                id={`phone-${member.id}`}
                value={member.phoneNumber}
                onChange={(e) => updateMember(member.id, "phoneNumber", e.target.value)}
                placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
                className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
                style={georgianStyle}
              />
            </div>

            <div>
              <Label htmlFor={`paymentStatus-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                <LanguageText>{t("events.paymentStatus")}</LanguageText>
              </Label>
              <Select
                value={member.paymentStatus}
                onValueChange={(value) => updateMember(member.id, "paymentStatus", value)}
              >
                <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={cn("bg-background", isGeorgian ? "font-georgian" : "")}>
                  <SelectItem value="not_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    <LanguageText>{t("crm.notPaid")}</LanguageText>
                  </SelectItem>
                  <SelectItem value="partly_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    <LanguageText>{t("crm.paidPartly")}</LanguageText>
                  </SelectItem>
                  <SelectItem value="fully_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    <LanguageText>{t("crm.paidFully")}</LanguageText>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(member.paymentStatus === "partly_paid" || member.paymentStatus === "fully_paid") && (
              <div>
                <Label htmlFor={`paymentAmount-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  <LanguageText>{t("events.paymentAmount")}</LanguageText>
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-gray-500">{currencySymbol}</span>
                  </div>
                  <Input
                    id={`paymentAmount-${member.id}`}
                    value={member.paymentAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        updateMember(member.id, "paymentAmount", value);
                      }
                    }}
                    className="pl-7"
                    placeholder="0.00"
                    type="text"
                    inputMode="decimal"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor={`notes-${member.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {renderGeorgianLabel("events.eventNotes")}
              </Label>
              <Textarea
                id={`notes-${member.id}`}
                value={member.notes}
                onChange={(e) => updateMember(member.id, "notes", e.target.value)}
                placeholder={isGeorgian ? "დაამატეთ შენიშვნები" : t("events.addEventNotes")}
                className={cn("min-h-[80px] resize-none", isGeorgian ? "placeholder:font-georgian font-georgian" : "")}
                style={georgianStyle}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {members.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          <LanguageText>{t("events.noMembersYet")}</LanguageText>
        </div>
      )}
    </div>
  );
};
