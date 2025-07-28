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
import { Archive, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface AddTaskFormProps {
  onClose: () => void;
  editingTask?: Task | null;
}

const AddTaskForm = ({ onClose, editingTask }: AddTaskFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileError, setFileError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deadline, setDeadline] = useState<string | undefined>();
  const [reminderAt, setReminderAt] = useState<string | undefined>();
  const [emailReminder, setEmailReminder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
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
      setEmailReminder(editingTask.email_reminder_enabled || false);
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

      const taskData = {
        title,
        description,
        status: editingTask ? editingTask.status : ('todo' as const),
        user_id: user.id,
        position: editingTask?.position || 0,
        deadline_at: deadline && deadline.trim() !== '' ? deadline : null,
        reminder_at: reminderAt && reminderAt.trim() !== '' ? reminderAt : null,
        email_reminder_enabled: emailReminder && reminderAt ? emailReminder : false,
        ...(editingTask && { updated_at: new Date().toISOString() })
      };

      let taskResponse;
      if (editingTask) {
        taskResponse = await updateTask(editingTask.id, taskData);
      } else {
        taskResponse = await createTask(taskData);
      }

      // Handle file upload with proper bucket assignment
      if (selectedFile && taskResponse) {
        console.log('Uploading file for task:', taskResponse.id);
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        // Upload to task_attachments bucket
        const { error: uploadError } = await supabase.storage
          .from('task_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('File upload error:', uploadError);
          throw uploadError;
        }

        console.log('File uploaded successfully, creating database record');
        
        // Create file record in files table
        const { error: fileRecordError } = await supabase
          .from('files')
          .insert({
            task_id: taskResponse.id,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id,
            source: 'task',
            parent_type: 'task'
          });

        if (fileRecordError) {
          console.error('File record creation error:', fileRecordError);
          throw fileRecordError;
        }

        console.log('File record created successfully');
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

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
  };

  const handleDelete = async () => {
    if (!editingTask || !user) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', editingTask.id)
        .eq('user_id', user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      toast({
        title: t("common.success"),
        description: t("tasks.taskDeleted"),
      });
      
      setShowDeleteConfirmation(false);
      onClose();
    } catch (error: any) {
      console.error('Task delete error:', error);
      toast({
        title: "Error",
        description: language === 'es'
          ? "Error al eliminar la tarea. Por favor intenta de nuevo."
          : error.message || "Failed to delete task. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
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
            emailReminder={emailReminder}
            setEmailReminder={setEmailReminder}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-muted/20">
            {editingTask && (
              <>
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
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="min-w-[120px]"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isGeorgian ? (
                    <GeorgianAuthText fontWeight="bold">
                      <LanguageText>
                        {isDeleting ? t("common.saving") : t("tasks.deleteTask")}
                      </LanguageText>
                    </GeorgianAuthText>
                  ) : (
                    <LanguageText>
                      {isDeleting ? t("common.saving") : t("tasks.deleteTask")}
                    </LanguageText>
                  )}
                </Button>
              </>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isGeorgian ? "დავალების წაშლა" : t("tasks.deleteTaskConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isGeorgian 
                ? "ნამდვილად გსურთ ამ დავალების წაშლა? ეს მოქმედება შეუქცევადია." 
                : t("tasks.deleteTaskConfirmation")
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirmation(false)}>
              {isGeorgian ? "გაუქმება" : t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isGeorgian ? "წაშლა" : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AddTaskForm;
