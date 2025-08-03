import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { TaskDateTimePicker } from "@/components/tasks/TaskDateTimePicker";
import { cn } from "@/lib/utils";

interface PersonData {
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
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  eventNotes: string;
  setEventNotes: (value: string) => void;
  eventName: string;
  setEventName: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
  setExistingFiles: (files: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>) => void;
  eventId?: string;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: string;
  setRepeatUntil: (value: string) => void;
  isNewEvent: boolean;
  additionalPersons: PersonData[];
  setAdditionalPersons: (persons: PersonData[]) => void;
  reminderTime: Date | null;
  setReminderTime: (time: Date | null) => void;
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
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  files,
  setFiles,
  existingFiles,
  setExistingFiles,
  eventId,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  isNewEvent,
  additionalPersons,
  setAdditionalPersons,
  reminderTime,
  setReminderTime,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(!!reminderTime);
  const isGeorgian = language === 'ka';

  const handleFileSelect = (newFile: File) => {
    setFiles([...files, newFile]);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const handleDeleteExistingFile = async (fileId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('event_attachments')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('event_files')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        console.error('Error deleting file record:', dbError);
        toast({
          title: t("common.error"),
          description: "Failed to delete file",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setExistingFiles(existingFiles.filter(file => file.id !== fileId));
      
      toast({
        title: t("common.success"),
        description: "File deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: t("common.error"),
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const addAdditionalPerson = () => {
    const newPerson: PersonData = {
      id: Date.now().toString(),
      userSurname: "",
      userNumber: "",
      socialNetworkLink: "",
      eventNotes: "",
      paymentStatus: "not_paid",
      paymentAmount: "",
    };
    setAdditionalPersons([...additionalPersons, newPerson]);
  };

  const removeAdditionalPerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== id));
  };

  const updateAdditionalPerson = (id: string, field: keyof PersonData, value: string) => {
    setAdditionalPersons(additionalPersons.map(person => 
      person.id === id ? { ...person, [field]: value } : person
    ));
  };

  const handleReminderCheckboxChange = (checked: boolean) => {
    setReminderEnabled(checked);
    if (checked) {
      // Open the reminder dialog
      setIsReminderDialogOpen(true);
    } else {
      // Clear reminder time
      setReminderTime(null);
    }
  };

  const handleReminderConfirm = (selectedDate: Date) => {
    setReminderTime(selectedDate);
    setIsReminderDialogOpen(false);
  };

  const handleReminderCancel = () => {
    setIsReminderDialogOpen(false);
    // If no reminder was set, uncheck the checkbox
    if (!reminderTime) {
      setReminderEnabled(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="userSurname">
          <LanguageText>{t("events.fullName")}</LanguageText>
        </Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div>
        <Label htmlFor="userNumber">
          <LanguageText>{t("events.phoneNumber")}</LanguageText>
        </Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div>
        <Label htmlFor="socialNetworkLink">
          <LanguageText>{t("events.socialLinkEmail")}</LanguageText>
        </Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div>
        <Label htmlFor="eventName">
          <LanguageText>{t("events.eventName")}</LanguageText>
        </Label>
        <Input
          id="eventName"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div>
        <Label htmlFor="eventNotes">
          <LanguageText>{t("events.eventNotes")}</LanguageText>
        </Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={t("events.addEventNotes")}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">
            <LanguageText>{t("events.start")}</LanguageText>
          </Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="endDate">
            <LanguageText>{t("events.end")}</LanguageText>
          </Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paymentStatus">
            <LanguageText>{t("events.paymentStatus")}</LanguageText>
          </Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger>
              <SelectValue placeholder={t("events.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">
                <LanguageText>Not Paid</LanguageText>
              </SelectItem>
              <SelectItem value="partly_paid">
                <LanguageText>Partly Paid</LanguageText>
              </SelectItem>
              <SelectItem value="fully_paid">
                <LanguageText>Fully Paid</LanguageText>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="paymentAmount">
            <LanguageText>{t("events.paymentAmount")}</LanguageText>
          </Label>
          <Input
            id="paymentAmount"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isRecurring"
            checked={isRecurring}
            onCheckedChange={(checked) => setIsRecurring(!!checked)}
          />
          <Label htmlFor="isRecurring">
            <LanguageText>Make this event recurring</LanguageText>
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="reminderEnabled"
            checked={reminderEnabled}
            onCheckedChange={handleReminderCheckboxChange}
          />
          <Label htmlFor="reminderEnabled">
            <LanguageText>{t("events.setReminder")}</LanguageText>
          </Label>
        </div>
      </div>

      {reminderTime && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <LanguageText>Reminder set for: {reminderTime.toLocaleString()}</LanguageText>
          </p>
        </div>
      )}

      {isRecurring && (
        <div className="space-y-4 p-4 border rounded-md">
          <div>
            <Label htmlFor="repeatPattern">
              <LanguageText>Repeat Pattern</LanguageText>
            </Label>
            <Select value={repeatPattern} onValueChange={setRepeatPattern}>
              <SelectTrigger>
                <SelectValue placeholder="Select repeat pattern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">
                  <LanguageText>Daily</LanguageText>
                </SelectItem>
                <SelectItem value="weekly">
                  <LanguageText>Weekly</LanguageText>
                </SelectItem>
                <SelectItem value="monthly">
                  <LanguageText>Monthly</LanguageText>
                </SelectItem>
                <SelectItem value="yearly">
                  <LanguageText>Yearly</LanguageText>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="repeatUntil">
              <LanguageText>Repeat Until</LanguageText>
            </Label>
            <Input
              id="repeatUntil"
              type="date"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <Label>
          <LanguageText>{t("common.attachments")}</LanguageText>
        </Label>
        
        {existingFiles.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              <LanguageText>Existing files:</LanguageText>
            </p>
            {existingFiles.map((file) => (
              <SimpleFileDisplay
                key={file.id}
                filename={file.filename}
                onDelete={() => handleDeleteExistingFile(file.id, file.file_path)}
              />
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              <LanguageText>New files to upload:</LanguageText>
            </p>
            {files.map((file, index) => (
              <SimpleFileDisplay
                key={index}
                filename={file.name}
                onDelete={() => handleRemoveFile(index)}
              />
            ))}
          </div>
        )}

        <div className="mt-2">
          <FileUploadField
            onFileSelect={handleFileSelect}
            acceptedFileTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            maxSizeMB={10}
          />
        </div>
      </div>

      {isNewEvent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">
              <LanguageText>Additional Persons</LanguageText>
            </h4>
            <Button type="button" variant="outline" onClick={addAdditionalPerson}>
              <LanguageText>Add Person</LanguageText>
            </Button>
          </div>

          {additionalPersons.map((person, index) => (
            <div key={person.id} className="space-y-3 p-4 border rounded-md">
              <div className="flex justify-between items-center">
                <h5 className="font-medium">
                  <LanguageText>Person {index + 2}</LanguageText>
                </h5>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => removeAdditionalPerson(person.id)}
                >
                  <LanguageText>Remove</LanguageText>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    <LanguageText>{t("events.fullName")}</LanguageText>
                  </Label>
                  <Input
                    value={person.userSurname}
                    onChange={(e) => updateAdditionalPerson(person.id, 'userSurname', e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                  />
                </div>

                <div>
                  <Label>
                    <LanguageText>{t("events.phoneNumber")}</LanguageText>
                  </Label>
                  <Input
                    value={person.userNumber}
                    onChange={(e) => updateAdditionalPerson(person.id, 'userNumber', e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                  />
                </div>
              </div>

              <div>
                <Label>
                  <LanguageText>{t("events.socialLinkEmail")}</LanguageText>
                </Label>
                <Input
                  value={person.socialNetworkLink}
                  onChange={(e) => updateAdditionalPerson(person.id, 'socialNetworkLink', e.target.value)}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                />
              </div>

              <div>
                <Label>
                  <LanguageText>{t("events.eventNotes")}</LanguageText>
                </Label>
                <Textarea
                  value={person.eventNotes}
                  onChange={(e) => updateAdditionalPerson(person.id, 'eventNotes', e.target.value)}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    <LanguageText>{t("events.paymentStatus")}</LanguageText>
                  </Label>
                  <Select 
                    value={person.paymentStatus} 
                    onValueChange={(value) => updateAdditionalPerson(person.id, 'paymentStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("events.selectPaymentStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_paid">
                        <LanguageText>Not Paid</LanguageText>
                      </SelectItem>
                      <SelectItem value="partly_paid">
                        <LanguageText>Partly Paid</LanguageText>
                      </SelectItem>
                      <SelectItem value="fully_paid">
                        <LanguageText>Fully Paid</LanguageText>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>
                    <LanguageText>{t("events.paymentAmount")}</LanguageText>
                  </Label>
                  <Input
                    type="number"
                    value={person.paymentAmount}
                    onChange={(e) => updateAdditionalPerson(person.id, 'paymentAmount', e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskDateTimePicker
        isOpen={isReminderDialogOpen}
        onClose={handleReminderCancel}
        onConfirm={handleReminderConfirm}
        initialDate={reminderTime || new Date()}
        title={t("events.setReminder")}
      />
    </div>
  );
};
