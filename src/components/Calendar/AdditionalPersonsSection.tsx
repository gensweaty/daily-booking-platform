
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdditionalPerson {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface AdditionalPersonsSectionProps {
  additionalPersons: AdditionalPerson[];
  setAdditionalPersons: (persons: AdditionalPerson[]) => void;
}

export const AdditionalPersonsSection = ({
  additionalPersons,
  setAdditionalPersons,
}: AdditionalPersonsSectionProps) => {
  const { t } = useLanguage();

  const addPerson = () => {
    const newPerson: AdditionalPerson = {
      id: crypto.randomUUID(),
      userSurname: "",
      userNumber: "",
      socialNetworkLink: "",
      eventNotes: "",
      paymentStatus: "not_paid",
      paymentAmount: "",
    };
    setAdditionalPersons([...additionalPersons, newPerson]);
  };

  const removePerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== id));
  };

  const updatePerson = (id: string, field: keyof AdditionalPerson, value: string) => {
    setAdditionalPersons(
      additionalPersons.map(person =>
        person.id === id ? { ...person, [field]: value } : person
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">{t("events.additionalPersons")}</Label>
        <Button type="button" onClick={addPerson} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          {t("events.addPerson")}
        </Button>
      </div>

      {additionalPersons.map((person, index) => (
        <div key={person.id} className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {t("events.person")} {index + 2}
            </Label>
            <Button
              type="button"
              onClick={() => removePerson(person.id)}
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`person-${person.id}-name`}>{t("events.fullName")}</Label>
              <Input
                id={`person-${person.id}-name`}
                placeholder={t("events.fullNamePlaceholder")}
                value={person.userSurname}
                onChange={(e) => updatePerson(person.id, "userSurname", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`person-${person.id}-phone`}>{t("events.phoneNumber")}</Label>
              <Input
                id={`person-${person.id}-phone`}
                type="tel"
                placeholder={t("events.phoneNumberPlaceholder")}
                value={person.userNumber}
                onChange={(e) => updatePerson(person.id, "userNumber", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`person-${person.id}-email`}>{t("events.email")}</Label>
              <Input
                id={`person-${person.id}-email`}
                type="email"
                placeholder={t("events.emailPlaceholder")}
                value={person.socialNetworkLink}
                onChange={(e) => updatePerson(person.id, "socialNetworkLink", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`person-${person.id}-payment`}>{t("events.paymentStatus")}</Label>
              <Select
                value={person.paymentStatus}
                onValueChange={(value) => updatePerson(person.id, "paymentStatus", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("events.selectPaymentStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
                  <SelectItem value="partly_paid">{t("events.partlyPaid")}</SelectItem>
                  <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(person.paymentStatus === "partly_paid" || person.paymentStatus === "fully_paid") && (
              <div className="space-y-2">
                <Label htmlFor={`person-${person.id}-amount`}>{t("events.paymentAmount")}</Label>
                <Input
                  id={`person-${person.id}-amount`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={person.paymentAmount}
                  onChange={(e) => updatePerson(person.id, "paymentAmount", e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`person-${person.id}-notes`}>{t("events.notes")}</Label>
              <Textarea
                id={`person-${person.id}-notes`}
                placeholder={t("events.notesPlaceholder")}
                value={person.eventNotes}
                onChange={(e) => updatePerson(person.id, "eventNotes", e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
