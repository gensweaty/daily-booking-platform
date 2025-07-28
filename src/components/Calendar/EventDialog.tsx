import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext";
import { EventDialogFields } from "./EventDialogFields";
import { EventFormData, AdditionalPerson } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileRecord } from "@/types/files";

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event?: any;
  onSave?: () => void;
}

export const EventDialog = ({ isOpen, onClose, event, onSave }: EventDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [formData, setFormData] = useState<EventFormData>({
    title: event?.title || '',
    name: event?.user_name || '',
    surname: event?.user_surname || '',
    phone: event?.user_number || '',
    email: event?.user_email || '',
    startDate: event?.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    endDate: event?.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    socialNetworkLink: event?.social_network_link || '',
    notes: event?.event_notes || '',
    paymentStatus: event?.payment_status || 'pending',
    paymentAmount: event?.payment_amount?.toString() || '',
    isRecurring: event?.is_recurring || false,
    repeatPattern: event?.repeat_pattern || 'daily',
    repeatUntil: event?.repeat_until ? new Date(event.repeat_until).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  });

  const [additionalPersons, setAdditionalPersons] = useState<AdditionalPerson[]>(
    event?.additional_persons ? JSON.parse(event.additional_persons) : [{ name: '', surname: '', phone: '', email: '' }]
  );
  const [existingFiles, setExistingFiles] = useState<FileRecord[]>(event?.attachments ? JSON.parse(event.attachments) : []);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const handleFileUpload = (file: File | null) => {
    if (file) {
      setNewFiles(prev => [...prev, file]);
    }
  };

  const handleFileRemove = (fileToRemove: FileRecord) => {
    setExistingFiles(prev => prev.filter(f => f.id !== fileToRemove.id));
  };

  const addAdditionalPerson = () => {
    setAdditionalPersons([...additionalPersons, { name: '', surname: '', phone: '', email: '' }]);
  };

  const removeAdditionalPerson = (index: number) => {
    const updatedPersons = [...additionalPersons];
    updatedPersons.splice(index, 1);
    setAdditionalPersons(updatedPersons);
  };

  const updateAdditionalPerson = (index: number, field: string, value: string) => {
    const updatedPersons = [...additionalPersons];
    updatedPersons[index][field] = value;
    setAdditionalPersons(updatedPersons);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const start_date = new Date(formData.startDate).toISOString();
    const end_date = new Date(formData.endDate).toISOString();
    const repeat_until = formData.isRecurring ? new Date(formData.repeatUntil).toISOString() : null;

    const upsertEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .upsert({
          id: event?.id,
          title: formData.title,
          user_id: supabase.auth.user()?.id,
          user_name: formData.name,
          user_surname: formData.surname,
          user_number: formData.phone,
          user_email: formData.email,
          start_date: start_date,
          end_date: end_date,
          social_network_link: formData.socialNetworkLink,
          event_notes: formData.notes,
          payment_status: formData.paymentStatus,
          payment_amount: parseFloat(formData.paymentAmount || '0'),
          is_recurring: formData.isRecurring,
          repeat_pattern: formData.repeatPattern,
          repeat_until: repeat_until,
          additional_persons: JSON.stringify(additionalPersons),
          attachments: JSON.stringify(existingFiles),
        }, { onConflict: 'id' });

      if (error) {
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: error.message,
        });
      } else {
        toast({
          title: t('common.success'),
          description: event ? t('events.eventUpdated') : t('events.eventCreated'),
        });
        onClose();
        onSave && onSave();
      }
    };

    await upsertEvent();
  }, [additionalPersons, event, formData, onClose, onSave, t, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event ? t('events.editEvent') : t('events.addEvent')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <EventDialogFields
            formData={formData}
            setFormData={setFormData}
            additionalPersons={additionalPersons}
            setAdditionalPersons={setAdditionalPersons}
            existingFiles={existingFiles.map(f => ({
              id: f.id,
              filename: f.filename,
              file_path: f.file_path,
              content_type: f.content_type,
              size: f.size,
              created_at: f.created_at || new Date().toISOString(),
              user_id: f.user_id || ''
            }))}
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
            event={event}
          />
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {event ? t('common.update') : t('common.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
