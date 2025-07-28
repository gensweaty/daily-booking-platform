
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { EventMetadataDisplay } from "./EventMetadataDisplay";
import { FileRecord } from "@/types/files";

interface AdditionalPerson {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface EventDialogFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  userSurname: string;
  setUserSurname: (userSurname: string) => void;
  userNumber: string;
  setUserNumber: (userNumber: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (socialNetworkLink: string) => void;
  eventNotes: string;
  setEventNotes: (eventNotes: string) => void;
  eventName: string;
  setEventName: (eventName: string) => void;
  paymentStatus: string;
  setPaymentStatus: (paymentStatus: string) => void;
  paymentAmount: string;
  setPaymentAmount: (paymentAmount: string) => void;
  startDate: string;
  setStartDate: (startDate: string) => void;
  endDate: string;
  setEndDate: (endDate: string) => void;
  isRecurring: boolean;
  setIsRecurring: (isRecurring: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (repeatPattern: string) => void;
  repeatUntil: string;
  setRepeatUntil: (repeatUntil: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: FileRecord[];
  setExistingFiles: (files: FileRecord[]) => void;
  additionalPersons: AdditionalPerson[];
  setAdditionalPersons: (additionalPersons: AdditionalPerson[]) => void;
  isVirtualEvent: boolean;
  isNewEvent: boolean;
  eventId?: string;
  eventCreatedAt?: string;
  eventUpdatedAt?: string;
}

export const EventDialogFields = ({
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  eventNotes,
  setEventNotes,
  eventName,
  setEventName,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  files,
  setFiles,
  existingFiles,
  setExistingFiles,
  additionalPersons,
  setAdditionalPersons,
  isVirtualEvent,
  isNewEvent,
  eventId,
  eventCreatedAt,
  eventUpdatedAt,
}: EventDialogFieldsProps) => {
  const { t } = useLanguage();

  const handleAddPerson = () => {
    setAdditionalPersons([
      ...additionalPersons,
      {
        id: Date.now().toString(),
        userSurname: "",
        userNumber: "",
        socialNetworkLink: "",
        eventNotes: "",
        paymentStatus: "",
        paymentAmount: "",
      },
    ]);
  };

  const handleRemovePerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter((person) => person.id !== id));
  };

  const updatePersonField = (
    id: string,
    field: keyof AdditionalPerson,
    value: string
  ) => {
    setAdditionalPersons(
      additionalPersons.map((person) =>
        person.id === id ? { ...person, [field]: value } : person
      )
    );
  };

  const handleFileUpload = (file: File | null) => {
    if (file) {
      setFiles([...files, file]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date & Time Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("events.dateTime")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">{t("events.startDate")}</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-background border-input"
            />
          </div>
          <div>
            <Label htmlFor="endDate">{t("events.endDate")}</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-background border-input"
            />
          </div>
        </div>

        {/* Recurring Event Options */}
        <div className="flex items-center space-x-2">
          <Switch
            id="isRecurring"
            checked={isRecurring}
            onCheckedChange={(checked) => setIsRecurring(checked)}
          />
          <Label htmlFor="isRecurring">{t("events.isRecurring")}</Label>
        </div>

        {isRecurring && (
          <div className="space-y-2">
            <div>
              <Label htmlFor="repeatPattern">{t("events.repeatPattern")}</Label>
              <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                <SelectTrigger className="w-full bg-background border-input">
                  <SelectValue placeholder={t("events.selectRepeatPattern")} />
                </SelectTrigger>
                <SelectContent className="bg-background border-input">
                  <SelectItem value="daily">{t("events.daily")}</SelectItem>
                  <SelectItem value="weekly">{t("events.weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("events.monthly")}</SelectItem>
                  <SelectItem value="yearly">{t("events.yearly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="repeatUntil">{t("events.repeatUntil")}</Label>
              <Input
                id="repeatUntil"
                type="date"
                value={repeatUntil}
                onChange={(e) => setRepeatUntil(e.target.value)}
                className="bg-background border-input"
              />
            </div>
          </div>
        )}
      </div>

      {/* Event Metadata Display - Only show for existing events */}
      {eventId && eventCreatedAt && eventUpdatedAt && (
        <EventMetadataDisplay 
          createdAt={eventCreatedAt} 
          updatedAt={eventUpdatedAt} 
        />
      )}

      {/* Person Data Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("events.personData")}</h3>
        
        {/* Main Person Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">{t("events.title")}</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border-input"
            />
          </div>
          <div>
            <Label htmlFor="userSurname">{t("events.userSurname")}</Label>
            <Input
              id="userSurname"
              type="text"
              value={userSurname}
              onChange={(e) => setUserSurname(e.target.value)}
              className="bg-background border-input"
            />
          </div>
          <div>
            <Label htmlFor="userNumber">{t("events.userNumber")}</Label>
            <Input
              id="userNumber"
              type="text"
              value={userNumber}
              onChange={(e) => setUserNumber(e.target.value)}
              className="bg-background border-input"
            />
          </div>
          <div>
            <Label htmlFor="socialNetworkLink">{t("events.socialNetworkLink")}</Label>
            <Input
              id="socialNetworkLink"
              type="text"
              value={socialNetworkLink}
              onChange={(e) => setSocialNetworkLink(e.target.value)}
              className="bg-background border-input"
            />
          </div>
          <div>
            <Label htmlFor="eventName">{t("events.eventName")}</Label>
            <Input
              id="eventName"
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="bg-background border-input"
            />
          </div>
          <div>
            <Label htmlFor="paymentStatus">{t("events.paymentStatus")}</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="w-full bg-background border-input">
                <SelectValue placeholder={t("events.selectPaymentStatus")} />
              </SelectTrigger>
              <SelectContent className="bg-background border-input">
                <SelectItem value="paid">{t("events.paid")}</SelectItem>
                <SelectItem value="pending">{t("events.pending")}</SelectItem>
                <SelectItem value="refunded">{t("events.refunded")}</SelectItem>
                <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="paymentAmount">{t("events.paymentAmount")}</Label>
            <Input
              id="paymentAmount"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="bg-background border-input"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="eventNotes">{t("events.eventNotes")}</Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            className="bg-background border-input"
          />
        </div>
      </div>

      {/* Additional Persons Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("events.additionalPersons")}</h3>
        {additionalPersons.map((person) => (
          <div key={person.id} className="space-y-2 border p-4 rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`userSurname-${person.id}`}>
                  {t("events.userSurname")}
                </Label>
                <Input
                  type="text"
                  id={`userSurname-${person.id}`}
                  value={person.userSurname}
                  onChange={(e) =>
                    updatePersonField(person.id, "userSurname", e.target.value)
                  }
                  className="bg-background border-input"
                />
              </div>
              <div>
                <Label htmlFor={`userNumber-${person.id}`}>
                  {t("events.userNumber")}
                </Label>
                <Input
                  type="text"
                  id={`userNumber-${person.id}`}
                  value={person.userNumber}
                  onChange={(e) =>
                    updatePersonField(person.id, "userNumber", e.target.value)
                  }
                  className="bg-background border-input"
                />
              </div>
              <div>
                <Label htmlFor={`socialNetworkLink-${person.id}`}>
                  {t("events.socialNetworkLink")}
                </Label>
                <Input
                  type="text"
                  id={`socialNetworkLink-${person.id}`}
                  value={person.socialNetworkLink}
                  onChange={(e) =>
                    updatePersonField(
                      person.id,
                      "socialNetworkLink",
                      e.target.value
                    )
                  }
                  className="bg-background border-input"
                />
              </div>
              <div>
                <Label htmlFor={`paymentStatus-${person.id}`}>
                  {t("events.paymentStatus")}
                </Label>
                <Select
                  value={person.paymentStatus}
                  onValueChange={(value) =>
                    updatePersonField(person.id, "paymentStatus", value)
                  }
                >
                  <SelectTrigger className="w-full bg-background border-input">
                    <SelectValue placeholder={t("events.selectPaymentStatus")} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-input">
                    <SelectItem value="paid">{t("events.paid")}</SelectItem>
                    <SelectItem value="pending">{t("events.pending")}</SelectItem>
                    <SelectItem value="refunded">{t("events.refunded")}</SelectItem>
                    <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`paymentAmount-${person.id}`}>
                  {t("events.paymentAmount")}
                </Label>
                <Input
                  type="number"
                  id={`paymentAmount-${person.id}`}
                  value={person.paymentAmount}
                  onChange={(e) =>
                    updatePersonField(person.id, "paymentAmount", e.target.value)
                  }
                  className="bg-background border-input"
                />
              </div>
            </div>
            <div>
              <Label htmlFor={`eventNotes-${person.id}`}>
                {t("events.eventNotes")}
              </Label>
              <Textarea
                id={`eventNotes-${person.id}`}
                value={person.eventNotes}
                onChange={(e) =>
                  updatePersonField(person.id, "eventNotes", e.target.value)
                }
                className="bg-background border-input"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleRemovePerson(person.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("common.remove")}
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" onClick={handleAddPerson}>
          <Plus className="h-4 w-4 mr-2" />
          {t("events.addAdditionalPerson")}
        </Button>
      </div>

      {/* Files Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("events.attachments")}</h3>
        {existingFiles.length > 0 && (
          <div className="space-y-2">
            <Label>{t("events.currentAttachments")}</Label>
            <SimpleFileDisplay
              files={existingFiles}
              bucketName="event_attachments"
              allowDelete
              parentType="event"
              setFiles={setExistingFiles}
            />
          </div>
        )}
        <FileUploadField onChange={handleFileUpload} />
      </div>
    </div>
  );
};
