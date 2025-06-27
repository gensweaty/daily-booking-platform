
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createTask, updateTask, archiveTask } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Task } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { TaskFormHeader } from "./tasks/TaskFormHeader";
import { TaskFormFields } from "./tasks/TaskFormFields";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "./shared/LanguageText";
import { useTimezoneValidation } from "@/hooks/useTimezoneValidation";
import { GeorgianAuthText } from "./shared/GeorgianAuthText";
import { Archive } from "lucide-react";

interface AddTaskFormProps {
  onClose: () => void;
  editingTask?: Task | null;
}

export const AddTaskForm = ({ onClose, editingTask }: AddTaskFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileError, setFileError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deadline, setDeadline] = useState<string | undefined>();
  const [reminderAt, setReminderAt] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { validateDateTime } = useTimezoneValidation();
  const isGeorgian = language === 'ka';

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || "");
      setDeadline(editingTask.deadline_at);
      setReminderAt(editingTask.reminder_at);
    }
  }, [editingTask]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Error",
        description: language === 'es' 
          ? "Debes iniciar sesión para crear tareas"
          : "You must be logged in to create tasks",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate deadline if provided
      if (deadline) {
        const deadlineValidation = await validateDateTime(deadline, 'deadline');
        if (!deadlineValidation.valid) {
          toast({
            title: "Invalid Deadline",
            description: deadlineValidation.message,
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Validate reminder if provided
      if (reminderAt) {
        const reminderValidation = await validateDateTime(
          reminderAt, 
          'reminder', 
          deadline
        );
        if (!reminderValidation.valid) {
          toast({
            title: "Invalid Reminder",
            description: reminderValidation.message,
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Fix: Explicitly handle null values for deadline and reminder
      // Convert empty strings or undefined to null for proper database updates
      const taskData = {
        title,
        description,
        status: editingTask ? editingTask.status : ('todo' as const),
        user_id: user.id,
        position: editingTask?.position || 0,
        deadline_at: deadline && deadline.trim() !== '' ? deadline : null,
        reminder_at: reminderAt && reminderAt.trim() !== '' ? reminderAt : null
      };

      let taskResponse;
      if (editingTask) {
        taskResponse = await updateTask(editingTask.id, taskData);
      } else {
        taskResponse = await createTask(taskData);
      }

      if (selectedFile && taskResponse) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { error: fileRecordError } = await supabase
          .from('files')
          .insert({
            task_id: taskResponse.id,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id
          });

        if (fileRecordError) throw fileRecordError;
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      
      toast({
        title: t("common.success"),
        description: editingTask ? t("tasks.taskUpdated") : t("tasks.taskAdded"),
      });
      
      onClose();
    } catch (error: any) {
      console.error('Task operation error:', error);
      toast({
        title: "Error",
        description: language === 'es'
          ? `Error al ${editingTask ? 'actualizar' : 'crear'} la tarea. Por favor intenta de nuevo.`
          : error.message || `Failed to ${editingTask ? 'update' : 'create'} task. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!editingTask || !user) return;

    setIsArchiving(true);

    try {
      await archiveTask(editingTask.id);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      toast({
        title: t("common.success"),
        description: t("tasks.taskArchived"),
      });
      
      onClose();
    } catch (error: any) {
      console.error('Task archive error:', error);
      toast({
        title: "Error",
        description: language === 'es'
          ? "Error al archivar la tarea. Por favor intenta de nuevo."
          : error.message || "Failed to archive task. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="w-full space-y-6 p-2">
      <TaskFormHeader editingTask={editingTask} />
      <form onSubmit={handleSubmit} className="space-y-6">
        <TaskFormFields
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
          editingTask={editingTask}
          deadline={deadline}
          setDeadline={setDeadline}
          reminderAt={reminderAt}
          setReminderAt={setReminderAt}
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-muted/20">
          {editingTask && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleArchive}
              disabled={isArchiving}
              className="min-w-[120px]"
            >
              <Archive className="mr-2 h-4 w-4" />
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="bold">
                  <LanguageText>
                    {isArchiving ? t("common.saving") : t("tasks.archive")}
                  </LanguageText>
                </GeorgianAuthText>
              ) : (
                <LanguageText>
                  {isArchiving ? t("common.saving") : t("tasks.archive")}
                </LanguageText>
              )}
            </Button>
          )}
          <Button type="submit" className="min-w-[120px]" disabled={isSubmitting}>
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="bold">
                <LanguageText>
                  {isSubmitting 
                    ? t("common.saving")
                    : (editingTask ? t("tasks.editTask") : t("tasks.addTask"))
                  }
                </LanguageText>
              </GeorgianAuthText>
            ) : (
              <LanguageText>
                {isSubmitting 
                  ? t("common.saving")
                  : (editingTask ? t("tasks.editTask") : t("tasks.addTask"))
                }
              </LanguageText>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
