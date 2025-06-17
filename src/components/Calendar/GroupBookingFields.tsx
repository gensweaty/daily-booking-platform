
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currency";

export interface GroupParticipant {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  notes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface GroupBookingFieldsProps {
  isGroupBooking: boolean;
  setIsGroupBooking: (value: boolean) => void;
  groupName: string;
  setGroupName: (value: string) => void;
  participants: GroupParticipant[];
  setParticipants: (participants: GroupParticipant[]) => void;
}

export const GroupBookingFields = ({
  isGroupBooking,
  setIsGroupBooking,
  groupName,
  setGroupName,
  participants,
  setParticipants,
}: GroupBookingFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  const addParticipant = () => {
    const newParticipant: GroupParticipant = {
      id: Date.now().toString(),
      fullName: '',
      email: '',
      phoneNumber: '',
      notes: '',
      paymentStatus: 'not_paid',
      paymentAmount: '',
    };
    setParticipants([...participants, newParticipant]);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const updateParticipant = (id: string, field: keyof GroupParticipant, value: string) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const showPaymentAmount = (participant: GroupParticipant) => {
    return participant.paymentStatus === "partly_paid" || participant.paymentStatus === "fully_paid";
  };

  return (
    <div className="space-y-4">
      {/* Group Booking Toggle */}
      <div className="flex items-center space-x-2">
        <Switch
          id="group-booking"
          checked={isGroupBooking}
          onCheckedChange={setIsGroupBooking}
        />
        <Label 
          htmlFor="group-booking" 
          className={cn(isGeorgian ? "font-georgian" : "")}
          style={georgianStyle}
        >
          {isGeorgian ? (
            <GeorgianAuthText>ჯგუფური ბუკინგი</GeorgianAuthText>
          ) : (
            <LanguageText>{t("events.groupBooking")}</LanguageText>
          )}
        </Label>
      </div>

      {/* Group Name Field - only shown when group booking is enabled */}
      {isGroupBooking && (
        <div>
          <Label 
            htmlFor="groupName"
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            {isGeorgian ? (
              <GeorgianAuthText>ჯგუფის სახელი</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.groupName")}</LanguageText>
            )}
          </Label>
          <Input
            id="groupName"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={isGeorgian ? "ჯგუფის სახელი" : t("events.groupNamePlaceholder")}
            required
            className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
            style={georgianStyle}
          />
        </div>
      )}

      {/* Participants Section - only shown when group booking is enabled */}
      {isGroupBooking && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label 
              className={cn("text-lg font-semibold", isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              {isGeorgian ? (
                <GeorgianAuthText>მონაწილეები</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.participants")}</LanguageText>
              )}
            </Label>
            <Button
              type="button"
              onClick={addParticipant}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isGeorgian ? (
                <GeorgianAuthText>მონაწილის დამატება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.addParticipant")}</LanguageText>
              )}
            </Button>
          </div>

          {/* Participants List */}
          <div className="space-y-6">
            {participants.map((participant, index) => (
              <div key={participant.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className={cn("font-semibold", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? (
                      <GeorgianAuthText>მონაწილე #{index + 1}</GeorgianAuthText>
                    ) : (
                      <LanguageText>{t("events.participantNumber", { number: index + 1 })}</LanguageText>
                    )}
                  </Label>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeParticipant(participant.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <Label 
                      className={cn(isGeorgian ? "font-georgian" : "")}
                      style={georgianStyle}
                    >
                      {isGeorgian ? (
                        <GeorgianAuthText>სრული სახელი</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("events.fullName")}</LanguageText>
                      )}
                    </Label>
                    <Input
                      value={participant.fullName}
                      onChange={(e) => updateParticipant(participant.id, 'fullName', e.target.value)}
                      placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")}
                      required
                      className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
                      style={georgianStyle}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <Label 
                      className={cn(isGeorgian ? "font-georgian" : "")}
                      style={georgianStyle}
                    >
                      {isGeorgian ? (
                        <GeorgianAuthText>ელფოსტა</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("events.email")}</LanguageText>
                      )}
                    </Label>
                    <Input
                      type="email"
                      value={participant.email}
                      onChange={(e) => updateParticipant(participant.id, 'email', e.target.value)}
                      placeholder="email@example.com"
                      required
                      style={georgianStyle}
                    />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <Label 
                      className={cn(isGeorgian ? "font-georgian" : "")}
                      style={georgianStyle}
                    >
                      {isGeorgian ? (
                        <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("events.phoneNumber")}</LanguageText>
                      )}
                    </Label>
                    <Input
                      value={participant.phoneNumber}
                      onChange={(e) => updateParticipant(participant.id, 'phoneNumber', e.target.value)}
                      placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
                      className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
                      style={georgianStyle}
                    />
                  </div>

                  {/* Payment Status */}
                  <div>
                    <Label 
                      className={cn(isGeorgian ? "font-georgian" : "")}
                      style={georgianStyle}
                    >
                      <LanguageText>{t("events.paymentStatus")}</LanguageText>
                    </Label>
                    <Select 
                      value={participant.paymentStatus} 
                      onValueChange={(value) => updateParticipant(participant.id, 'paymentStatus', value)}
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
                </div>

                {/* Payment Amount - only shown when partly or fully paid */}
                {showPaymentAmount(participant) && (
                  <div>
                    <Label 
                      className={cn(isGeorgian ? "font-georgian" : "")}
                      style={georgianStyle}
                    >
                      <LanguageText>{t("events.paymentAmount")}</LanguageText>
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-gray-500">{currencySymbol}</span>
                      </div>
                      <Input
                        value={participant.paymentAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^\d*\.?\d*$/.test(value)) {
                            updateParticipant(participant.id, 'paymentAmount', value);
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

                {/* Notes */}
                <div>
                  <Label 
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    style={georgianStyle}
                  >
                    {isGeorgian ? (
                      <GeorgianAuthText>შენიშვნები</GeorgianAuthText>
                    ) : (
                      <LanguageText>{t("events.notes")}</LanguageText>
                    )}
                  </Label>
                  <Textarea
                    value={participant.notes}
                    onChange={(e) => updateParticipant(participant.id, 'notes', e.target.value)}
                    placeholder={isGeorgian ? "შენიშვნები ამ მონაწილეზე" : t("events.participantNotes")}
                    className={cn("min-h-[80px] resize-none", isGeorgian ? "placeholder:font-georgian font-georgian" : "")}
                    style={georgianStyle}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
