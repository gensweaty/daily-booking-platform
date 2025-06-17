
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GroupParticipant } from "@/lib/types/calendar";
import { getCurrencySymbol } from "@/lib/currency";

interface GroupParticipantsProps {
  participants: GroupParticipant[];
  setParticipants: (participants: GroupParticipant[]) => void;
}

export const GroupParticipants = ({ participants, setParticipants }: GroupParticipantsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);

  const addParticipant = () => {
    const newParticipant: GroupParticipant = {
      user_surname: "",
      user_number: "",
      social_network_link: "",
      event_notes: "",
      payment_status: "not_paid",
      payment_amount: 0
    };
    setParticipants([...participants, newParticipant]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: keyof GroupParticipant, value: string | number) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    setParticipants(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className={cn("text-sm font-medium", isGeorgian ? "font-georgian" : "")}>
          Group Participants ({participants.length})
        </Label>
        <Button type="button" onClick={addParticipant} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Add Person
        </Button>
      </div>

      {participants.map((participant, index) => (
        <Card key={index} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Person {index + 1}
              </CardTitle>
              {participants.length > 1 && (
                <Button 
                  type="button"
                  onClick={() => removeParticipant(index)}
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor={`participant-name-${index}`} className={cn("text-xs", isGeorgian ? "font-georgian" : "")}>
                Full Name
              </Label>
              <Input
                id={`participant-name-${index}`}
                value={participant.user_surname}
                onChange={(e) => updateParticipant(index, 'user_surname', e.target.value)}
                placeholder="Full Name"
                className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`participant-phone-${index}`} className={cn("text-xs", isGeorgian ? "font-georgian" : "")}>
                  Phone
                </Label>
                <Input
                  id={`participant-phone-${index}`}
                  value={participant.user_number}
                  onChange={(e) => updateParticipant(index, 'user_number', e.target.value)}
                  placeholder="Phone Number"
                  className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
                />
              </div>
              <div>
                <Label htmlFor={`participant-email-${index}`} className={cn("text-xs", isGeorgian ? "font-georgian" : "")}>
                  Email
                </Label>
                <Input
                  id={`participant-email-${index}`}
                  value={participant.social_network_link}
                  onChange={(e) => updateParticipant(index, 'social_network_link', e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`participant-payment-${index}`} className={cn("text-xs", isGeorgian ? "font-georgian" : "")}>
                  Payment Status
                </Label>
                <Select 
                  value={participant.payment_status} 
                  onValueChange={(value) => updateParticipant(index, 'payment_status', value)}
                >
                  <SelectTrigger id={`participant-payment-${index}`} className={cn("text-xs", isGeorgian ? "font-georgian" : "")}>
                    <SelectValue placeholder="Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_paid">Not Paid</SelectItem>
                    <SelectItem value="partly_paid">Partly Paid</SelectItem>
                    <SelectItem value="fully_paid">Fully Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(participant.payment_status === "partly_paid" || participant.payment_status === "fully_paid") && (
                <div>
                  <Label htmlFor={`participant-amount-${index}`} className={cn("text-xs", isGeorgian ? "font-georgian" : "")}>
                    Amount
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                      <span className="text-gray-500 text-xs">{currencySymbol}</span>
                    </div>
                    <Input
                      id={`participant-amount-${index}`}
                      value={participant.payment_amount?.toString() || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                          updateParticipant(index, 'payment_amount', value ? parseFloat(value) : 0);
                        }
                      }}
                      className="pl-6 text-xs"
                      placeholder="0.00"
                      type="text"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor={`participant-notes-${index}`} className={cn("text-xs", isGeorgian ? "font-georgian" : "")}>
                Notes
              </Label>
              <Textarea
                id={`participant-notes-${index}`}
                value={participant.event_notes}
                onChange={(e) => updateParticipant(index, 'event_notes', e.target.value)}
                placeholder="Additional notes..."
                className={cn("min-h-[60px] resize-none text-xs", isGeorgian ? "placeholder:font-georgian font-georgian" : "")}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {participants.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No participants added yet</p>
          <Button type="button" onClick={addParticipant} size="sm" className="mt-2">
            <Plus className="h-4 w-4 mr-1" />
            Add First Person
          </Button>
        </div>
      )}
    </div>
  );
};
