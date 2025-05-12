
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createTask, updateTask } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Task } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { TaskFormHeader } from "./tasks/TaskFormHeader";
import { TaskFormFields } from "./tasks/TaskFormFields";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "./shared/LanguageText";

interface AddTaskFormProps {
  onClose: () => void;
  editingTask?: Task | null;
}

export const AddTaskForm = ({ onClose, editingTask }: AddTaskFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileError, setFileError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { language, t } = useLanguage();

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      const initialDescription = editingTask.description || "";
      setDescription(initialDescription);
    }
  }, [editingTask]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        variant: "destructive",
        description: language === 'es' 
          ? "Debes iniciar sesión para crear tareas"
          : "You must be logged in to create tasks"
      });
      return;
    }

    try {
      const taskData = {
        title,
        description,
        status: editingTask ? editingTask.status : ('todo' as const),
        user_id: user.id,
        position: editingTask?.position || 0
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
        
        // Use event_attachments bucket for all files
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
      
      if (editingTask) {
        toast.task.updated();
      } else {
        toast.task.created();
      }
      onClose();
    } catch (error: any) {
      console.error('Task operation error:', error);
      toast({
        variant: "destructive",
        description: language === 'es'
          ? `Error al ${editingTask ? 'actualizar' : 'crear'} la tarea. Por favor intenta de nuevo.`
          : error.message || `Failed to ${editingTask ? 'update' : 'create'} task. Please try again.`
      });
    }
  };

  return (
    <>
      <TaskFormHeader editingTask={editingTask} />
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
        />
        <Button type="submit" className="w-full">
          <LanguageText>
            {editingTask ? t("tasks.editTask") : t("tasks.addTask")}
          </LanguageText>
        </Button>
      </form>
    </>
  );
};
