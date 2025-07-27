
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Reminder } from "@/lib/types";

interface AddReminderFormProps {
  onReminderAdded: (reminder: Reminder) => void;
  onClose: () => void;
}

export function AddReminderForm({ onReminderAdded, onClose }: AddReminderFormProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reminder_time: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: t("common.error"),
          description: "You must be logged in to add reminders",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("reminders")
        .insert([
          {
            title: formData.title,
            description: formData.description,
            reminder_time: formData.reminder_time,
            user_id: user.id,
            completed: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const newReminder: Reminder = {
        id: data.id,
        title: data.title,
        description: data.description,
        reminder_time: data.reminder_time,
        completed: data.completed,
        user_id: data.user_id,
      };

      onReminderAdded(newReminder);
      toast({
        title: t("common.success"),
        description: t("reminders.reminderCreated"),
      });
      onClose();
    } catch (error) {
      console.error("Error adding reminder:", error);
      toast({
        title: t("common.error"),
        description: "Failed to add reminder",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">{t("common.title")}</Label>
        <Input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">{t("common.description")}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={t("common.description")}
        />
      </div>

      <div>
        <Label htmlFor="reminder_time">{t("reminders.reminderTime")}</Label>
        <Input
          id="reminder_time"
          type="datetime-local"
          value={formData.reminder_time}
          onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("common.saving") : t("common.save")}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
