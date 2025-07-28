import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Calendar, Clock, User, CreditCard, FileText, Repeat } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdditionalPerson, EventFormData, CalendarEventType } from "@/lib/types/calendar";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { FileRecord } from "@/types/files";
import { EventMetadata } from "./EventMetadata";

interface EventDialogFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  userSurname: string;
  setUserSurname: (surname: string) => void;
  userNumber: string;
  setUserNumber: (number: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (link: string) => void;
  eventNotes: string;
  setEventNotes: (notes: string) => void;
  eventName: string;
  setEventName: (name: string) => void;
  paymentStatus: string;
  setPaymentStatus: (status: string) => void;
  paymentAmount: string;
  setPaymentAmount: (amount: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  isRecurring: boolean;
  setIsRecurring: (recurring: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (pattern: string) => void;
  repeatUntil: string;
  setRepeatUntil: (until: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: FileRecord[];
  setExistingFiles: (files: FileRecord[]) => void;
  additionalPersons: AdditionalPerson[];
  setAdditionalPersons: (persons: AdditionalPerson[]) => void;
  isVirtualEvent: boolean;
  isNewEvent: boolean;
  initialData?: CalendarEventType;
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
  initialData
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();

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

  const updatePersonField = (id: string, field: string, value: string) => {
    setAdditionalPersons(
      additionalPersons.map((person) =>
        person.id === id ? { ...person, [field]: value } : person
      )
    );
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      // Optimistically update the UI
      setExistingFiles((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
  
      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('event_attachments')
        .remove([existingFiles.find(file => file.id === fileId)?.file_path || '']);
  
      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Revert the UI update if storage deletion fails
        toast({
          title: t("common.error"),
          description: t("files.deleteError"),
          variant: "destructive",
        });
        setExistingFiles((prevFiles) => {
          const fileToDelete = prevFiles.find((file) => file.id === fileId);
          return fileToDelete ? [...prevFiles, fileToDelete] : prevFiles;
        });
        return;
      }
  
      // Delete the file record from the database
      const { error: dbError } = await supabase
        .from('event_files')
        .delete()
        .eq('id', fileId);
  
      if (dbError) {
        console.error('Error deleting file record:', dbError);
        // Revert the UI update if database deletion fails
        toast({
          title: t("common.error"),
          description: t("files.deleteError"),
          variant: "destructive",
        });
        setExistingFiles((prevFiles) => {
          const fileToDelete = prevFiles.find((file) => file.id === fileId);
          return fileToDelete ? [...prevFiles, fileToDelete] : prevFiles;
        });
        return;
      }
  
      toast({
        title: t("common.success"),
        description: t("files.fileDeleted"),
      });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("files.deleteError"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Date & Time Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("events.dateTimeSection")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date" className="text-sm font-medium">
                {t("events.startDate")}
              </Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-sm font-medium">
                {t("events.endDate")}
              </Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>
          
          {/* Recurring Event Options */}
          {!isVirtualEvent && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
                <Label htmlFor="is-recurring" className="text-sm font-medium flex items-center gap-2">
                  <Repeat className="h-4 w-4" />
                  {t("events.recurring")}
                </Label>
              </div>
              
              {isRecurring && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="repeat-pattern" className="text-sm font-medium">
                      {t("events.repeatPattern")}
                    </Label>
                    <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t("events.selectPattern")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">{t("events.daily")}</SelectItem>
                        <SelectItem value="weekly">{t("events.weekly")}</SelectItem>
                        <SelectItem value="monthly">{t("events.monthly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="repeat-until" className="text-sm font-medium">
                      {t("events.repeatUntil")}
                    </Label>
                    <Input
                      id="repeat-until"
                      type="date"
                      value={repeatUntil}
                      onChange={(e) => setRepeatUntil(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Metadata - Show only for existing events */}
      {initialData && (
        <EventMetadata
          createdAt={initialData.created_at}
          updatedAt={initialData.created_at}
        />
      )}

      {/* Person Data Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            {t("events.personData")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm font-medium">
              {t("events.title")}
            </Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="user-surname" className="text-sm font-medium">
              {t("events.userSurname")}
            </Label>
            <Input
              id="user-surname"
              type="text"
              value={userSurname}
              onChange={(e) => setUserSurname(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="user-number" className="text-sm font-medium">
              {t("events.userNumber")}
            </Label>
            <Input
              id="user-number"
              type="tel"
              value={userNumber}
              onChange={(e) => setUserNumber(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="social-network-link" className="text-sm font-medium">
              {t("events.socialNetworkLink")}
            </Label>
            <Input
              id="social-network-link"
              type="email"
              value={socialNetworkLink}
              onChange={(e) => setSocialNetworkLink(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="event-notes" className="text-sm font-medium">
              {t("events.eventNotes")}
            </Label>
            <Textarea
              id="event-notes"
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="event-name" className="text-sm font-medium">
              {t("events.eventName")}
            </Label>
            <Input
              id="event-name"
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Information Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("events.paymentInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="payment-status" className="text-sm font-medium">
              {t("events.paymentStatus")}
            </Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("events.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">{t("events.paid")}</SelectItem>
                <SelectItem value="pending">{t("events.pending")}</SelectItem>
                <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="payment-amount" className="text-sm font-medium">
              {t("events.paymentAmount")}
            </Label>
            <Input
              id="payment-amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* File Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("files.attachments")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadField files={files} setFiles={setFiles} />

          {existingFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("files.existingFiles")}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {existingFiles.map((file) => (
                  <FileDisplay
                    key={file.id}
                    file={file}
                    onDelete={handleDeleteFile}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Persons Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t("events.additionalPersons")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {additionalPersons.map((person) => (
            <div key={person.id} className="space-y-2 border p-4 rounded-md">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">{t("events.person")}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePerson(person.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label htmlFor={`user-surname-${person.id}`} className="text-sm font-medium">
                  {t("events.userSurname")}
                </Label>
                <Input
                  id={`user-surname-${person.id}`}
                  type="text"
                  value={person.userSurname}
                  onChange={(e) => updatePersonField(person.id, "userSurname", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`user-number-${person.id}`} className="text-sm font-medium">
                  {t("events.userNumber")}
                </Label>
                <Input
                  id={`user-number-${person.id}`}
                  type="tel"
                  value={person.userNumber}
                  onChange={(e) => updatePersonField(person.id, "userNumber", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`social-network-link-${person.id}`} className="text-sm font-medium">
                  {t("events.socialNetworkLink")}
                </Label>
                <Input
                  id={`social-network-link-${person.id}`}
                  type="email"
                  value={person.socialNetworkLink}
                  onChange={(e) => updatePersonField(person.id, "socialNetworkLink", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`event-notes-${person.id}`} className="text-sm font-medium">
                  {t("events.eventNotes")}
                </Label>
                <Textarea
                  id={`event-notes-${person.id}`}
                  value={person.eventNotes}
                  onChange={(e) => updatePersonField(person.id, "eventNotes", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`payment-status-${person.id}`} className="text-sm font-medium">
                  {t("events.paymentStatus")}
                </Label>
                <Select value={person.paymentStatus} onValueChange={(value) => updatePersonField(person.id, "paymentStatus", value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("events.selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">{t("events.paid")}</SelectItem>
                    <SelectItem value="pending">{t("events.pending")}</SelectItem>
                    <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`payment-amount-${person.id}`} className="text-sm font-medium">
                  {t("events.paymentAmount")}
                </Label>
                <Input
                  id={`payment-amount-${person.id}`}
                  type="number"
                  value={person.paymentAmount}
                  onChange={(e) => updatePersonField(person.id, "paymentAmount", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={handleAddPerson}>
            {t("events.addPerson")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
