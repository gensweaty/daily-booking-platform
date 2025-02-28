
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createTask, updateTask } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Task } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { TaskFormHeader } from "./tasks/TaskFormHeader";
import { TaskFormFields } from "./tasks/TaskFormFields";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { language } = useLanguage();

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
        title: "Error",
        description: language === 'es' 
          ? "Debes iniciar sesión para crear tareas"
          : "You must be logged in to create tasks",
        variant: "destructive",
      });
      return;
    }

    try {
      const taskData = {
        title,
        description,
        status: editingTask ? editingTask.status : ('todo' as const),
        user_id: user.id
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
          .from('task_attachments')
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
        title: language === 'es' ? "Éxito" : "Success",
        description: language === 'es'
          ? editingTask 
            ? "Tarea actualizada exitosamente"
            : "Tarea creada exitosamente"
          : editingTask
            ? "Task updated successfully"
            : "Task created successfully",
      });
      onClose();
    } catch (error: any) {
      console.error('Task operation error:', error);
      toast({
        title: "Error",
        description: language === 'es'
          ? `Error al ${editingTask ? 'actualizar' : 'crear'} la tarea. Por favor intenta de nuevo.`
          : error.message || `Failed to ${editingTask ? 'update' : 'create'} task. Please try again.`,
        variant: "destructive",
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
          {language === 'es'
            ? editingTask ? 'Actualizar Tarea' : 'Agregar Tarea'
            : editingTask ? 'Update Task' : 'Add Task'
          }
        </Button>
      </form>
    </>
  );
};
