
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { EventMetadataDisplay } from "./EventMetadataDisplay";
import { Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventFormData, AdditionalPerson } from "@/lib/types/calendar";
import { FileRecord } from "@/types/files";

interface EventDialogFieldsProps {
  formData: EventFormData;
  setFormData: (data: EventFormData) => void;
  additionalPersons: AdditionalPerson[];
  setAdditionalPersons: (persons: AdditionalPerson[]) => void;
  existingFiles: FileRecord[];
  onFileUpload: (file: File | null) => void;
  onFileRemove: (file: FileRecord) => void;
  event?: any;
}

export const EventDialogFields = ({
  formData,
  setFormData,
  additionalPersons,
  setAdditionalPersons,
  existingFiles,
  onFileUpload,
  onFileRemove,
  event
}: EventDialogFieldsProps) => {
  const { t } = useLanguage();

  const addAdditionalPerson = () => {
    setAdditionalPersons([
      ...additionalPersons,
      { name: '', surname: '', phone: '', email: '' },
    ]);
  };

  const removeAdditionalPerson = (index: number) => {
    const newPersons = [...additionalPersons];
    newPersons.splice(index, 1);
    setAdditionalPersons(newPersons);
  };

  const updateAdditionalPerson = (
    index: number,
    field: string,
    value: string
  ) => {
    const newPersons = [...additionalPersons];
    newPersons[index][field] = value;
    setAdditionalPersons(newPersons);
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <Label htmlFor="title">{t('events.title')}</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      {/* Person Data Section */}
      <div>
        <Label className="text-base font-medium">{t('events.personData')}</Label>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <Label htmlFor="name">{t('events.name')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="surname">{t('events.surname')}</Label>
            <Input
              id="surname"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <Label htmlFor="phone">{t('events.phone')}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">{t('events.email')}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Event Metadata Display - only show for existing events */}
      {event && event.created_at && (
        <EventMetadataDisplay 
          createdAt={event.created_at}
          updatedAt={event.updated_at}
        />
      )}

      {/* Date & Time Section */}
      <div>
        <Label className="text-base font-medium">{t('events.dateTime')}</Label>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <Label htmlFor="startDate">{t('events.startDate')}</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate">{t('events.endDate')}</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              required
            />
          </div>
        </div>
      </div>

      {/* Additional fields */}
      <div>
        <Label htmlFor="socialNetworkLink">{t('events.socialNetworkLink')}</Label>
        <Input
          id="socialNetworkLink"
          value={formData.socialNetworkLink}
          onChange={(e) => setFormData({ ...formData, socialNetworkLink: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="notes">{t('events.notes')}</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </div>

      {/* Payment Status */}
      <div>
        <Label htmlFor="paymentStatus">{t('events.paymentStatus')}</Label>
        <Select value={formData.paymentStatus} onValueChange={(value) => setFormData({ ...formData, paymentStatus: value })}>
          <SelectTrigger>
            <SelectValue placeholder={t('events.selectPaymentStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">{t('events.paid')}</SelectItem>
            <SelectItem value="pending">{t('events.pending')}</SelectItem>
            <SelectItem value="refunded">{t('events.refunded')}</SelectItem>
            <SelectItem value="not_paid">{t('events.notPaid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="paymentAmount">{t('events.paymentAmount')}</Label>
        <Input
          id="paymentAmount"
          type="number"
          step="0.01"
          value={formData.paymentAmount}
          onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
        />
      </div>

      {/* Recurring Event Options */}
      <div className="flex items-center space-x-2">
        <Switch
          id="isRecurring"
          checked={formData.isRecurring}
          onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
        />
        <Label htmlFor="isRecurring">{t('events.isRecurring')}</Label>
      </div>

      {formData.isRecurring && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="repeatPattern">{t('events.repeatPattern')}</Label>
            <Select value={formData.repeatPattern} onValueChange={(value) => setFormData({ ...formData, repeatPattern: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t('events.selectRepeatPattern')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('events.daily')}</SelectItem>
                <SelectItem value="weekly">{t('events.weekly')}</SelectItem>
                <SelectItem value="monthly">{t('events.monthly')}</SelectItem>
                <SelectItem value="yearly">{t('events.yearly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="repeatUntil">{t('events.repeatUntil')}</Label>
            <Input
              id="repeatUntil"
              type="date"
              value={formData.repeatUntil}
              onChange={(e) => setFormData({ ...formData, repeatUntil: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Additional Persons */}
      <div>
        <Label className="text-base font-medium">{t('events.additionalPersons')}</Label>
        {additionalPersons.map((person, index) => (
          <div key={index} className="border rounded p-3 mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Person {index + 1}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeAdditionalPerson(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={t('events.name')}
                value={person.name}
                onChange={(e) => updateAdditionalPerson(index, 'name', e.target.value)}
              />
              <Input
                placeholder={t('events.surname')}
                value={person.surname}
                onChange={(e) => updateAdditionalPerson(index, 'surname', e.target.value)}
              />
              <Input
                placeholder={t('events.phone')}
                value={person.phone}
                onChange={(e) => updateAdditionalPerson(index, 'phone', e.target.value)}
              />
              <Input
                placeholder={t('events.email')}
                type="email"
                value={person.email}
                onChange={(e) => updateAdditionalPerson(index, 'email', e.target.value)}
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={addAdditionalPerson}
          className="mt-2"
        >
          {t('events.addAdditionalPerson')}
        </Button>
      </div>

      {/* File Attachments */}
      <div>
        <Label className="text-base font-medium">{t('events.attachments')}</Label>
        <FileUploadField
          onUpload={onFileUpload}
          bucketName="event-attachments"
          allowedTypes={['image/*', 'application/pdf', '.doc,.docx,.txt']}
          maxSize={10 * 1024 * 1024} // 10MB
        />
        
        {existingFiles.length > 0 && (
          <div className="mt-2">
            <Label className="text-sm font-medium">{t('events.currentAttachments')}</Label>
            <FileDisplay
              files={existingFiles}
              allowDelete={true}
              parentType="event"
              onFileDelete={onFileRemove}
            />
          </div>
        )}
      </div>
    </div>
  );
};
