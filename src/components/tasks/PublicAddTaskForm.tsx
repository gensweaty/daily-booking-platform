import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { Task } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { TaskFormHeader } from "./TaskFormHeader";
import { TaskFormTitle } from "./TaskFormTitle";
import { TaskFormDescription } from "./TaskFormDescription";
import { TaskDateTimePicker } from "./TaskDateTimePicker";
import { TaskStatusSelect } from "./TaskStatusSelect";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { X } from "lucide-react";

interface PublicAddTaskFormProps {
  onClose: () => void;
  editingTask?: Task | null;
  boardUserId: string;
  externalUserName: string;
}

export const PublicAddTaskForm = ({ 
  onClose, 
  editingTask, 
  boardUserId,
  externalUserName 
}: PublicAddTaskFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<'todo' | 'inprogress' | 'done'>('todo');
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [reminder, setReminder] = useState<Date | undefined>(undefined);
  const [emailReminder, setEmailReminder] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Initialize form when editing
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || "");
      setStatus(editingTask.status);
      
      if (editingTask.deadline_at) {
        setDeadline(new Date(editingTask.deadline_at));
      }
      
      if (editingTask.reminder_at) {
        setReminder(new Date(editingTask.reminder_at));
      }
      
      setEmailReminder(editingTask.email_reminder_enabled || false);
    }
  }, [editingTask]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: t("common.error"),
        description: t("tasks.titleRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let fileUrl = null;
      
      // Handle file upload if present
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('task_attachments')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('task_attachments')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
      }

      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        deadline_at: deadline?.toISOString() || null,
        reminder_at: reminder?.toISOString() || null,
        email_reminder_enabled: emailReminder,
        user_id: boardUserId,
        ...(editingTask ? {
          last_edited_by_type: 'external_user',
          last_edited_by_name: externalUserName,
          last_edited_at: new Date().toISOString(),
        } : {
          created_by_type: 'external_user',
          created_by_name: externalUserName,
        }),
      };

      if (editingTask) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', editingTask.id)
          .eq('user_id', boardUserId);

        if (error) throw error;

        // Handle file upload for existing task
        if (file && fileUrl) {
          await supabase
            .from('files')
            .insert({
              task_id: editingTask.id,
              filename: file.name,
              file_path: fileUrl,
              content_type: file.type,
              size: file.size,
              user_id: boardUserId,
            });
        }

        toast({
          title: t("common.success"),
          description: t("tasks.taskUpdated"),
        });
      } else {
        // Create new task
        const { data: newTask, error } = await supabase
          .from('tasks')
          .insert(taskData)
          .select()
          .single();

        if (error) throw error;

        // Handle file upload for new task
        if (file && fileUrl && newTask) {
          await supabase
            .from('files')
            .insert({
              task_id: newTask.id,
              filename: file.name,
              file_path: fileUrl,
              content_type: file.type,
              size: file.size,
              user_id: boardUserId,
            });
        }

        toast({
          title: t("common.success"),
          description: t("tasks.taskCreated"),
        });
      }

      // Invalidate queries to refresh the task list
      queryClient.invalidateQueries({ queryKey: ['publicTasks', boardUserId] });
      onClose();

    } catch (error: any) {
      console.error('Error saving task:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("tasks.errorSaving"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {editingTask ? t("tasks.editTask") : t("tasks.addTask")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <TaskFormTitle
          title={title}
          setTitle={setTitle}
        />

        <TaskFormDescription
          description={description}
          setDescription={setDescription}
        />

        <TaskStatusSelect
          status={status}
          setStatus={setStatus}
        />

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deadline">{t("tasks.deadline")}</Label>
              <Input
                type="datetime-local"
                value={deadline ? deadline.toISOString().slice(0, 16) : ""}
                onChange={(e) => setDeadline(e.target.value ? new Date(e.target.value) : undefined)}
              />
            </div>
            <div>
              <Label htmlFor="reminder">{t("tasks.reminder")}</Label>
              <Input
                type="datetime-local"
                value={reminder ? reminder.toISOString().slice(0, 16) : ""}
                onChange={(e) => setReminder(e.target.value ? new Date(e.target.value) : undefined)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file">{t("common.attachments")}</Label>
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="flex-1"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                {editingTask ? t("common.updating") : t("common.creating")}
              </div>
            ) : (
              editingTask ? t("common.update") : t("common.create")
            )}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
};