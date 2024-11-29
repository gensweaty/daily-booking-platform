import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask, updateTask } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Task } from "@/lib/types";
import { FileUploadField } from "./shared/FileUploadField";
import { RichTextEditor } from "./shared/RichTextEditor";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { FileDisplay } from "./shared/FileDisplay";

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

  const { data: existingFiles } = useQuery({
    queryKey: ['taskFiles', editingTask?.id],
    queryFn: async () => {
      if (!editingTask?.id) return [];
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', editingTask.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!editingTask?.id,
  });

  // Initialize form with existing task data
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      // Initialize description with HTML content
      setDescription(editingTask.description || "");
    } else {
      setTitle("");
      setDescription("");
    }
  }, [editingTask]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create tasks",
        variant: "destructive",
      });
      return;
    }

    try {
      let taskId;
      const taskData = {
        title,
        description,
        status: editingTask ? editingTask.status : 'todo',
        user_id: user.id
      };

      if (editingTask) {
        const updatedTask = await updateTask(editingTask.id, taskData);
        taskId = updatedTask.id;
      } else {
        const newTask = await createTask(taskData);
        taskId = newTask.id;
      }

      if (selectedFile && taskId) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { error: fileRecordError } = await supabase
          .from('files')
          .insert({
            task_id: taskId,
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
        title: "Success",
        description: editingTask ? "Task updated successfully" : "Task created successfully",
      });
      onClose();
    } catch (error: any) {
      console.error('Task operation error:', error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingTask ? 'update' : 'create'} task. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DialogTitle className="text-foreground">{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="bg-background border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <RichTextEditor
            content={description}
            onChange={setDescription}
          />
        </div>
        {existingFiles && existingFiles.length > 0 && (
          <div className="space-y-2">
            <Label>Current Attachments</Label>
            <FileDisplay 
              files={existingFiles} 
              bucketName="task_attachments"
              allowDelete
            />
          </div>
        )}
        <FileUploadField 
          onFileChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
        />
        <Button type="submit" className="w-full">
          {editingTask ? 'Update Task' : 'Add Task'}
        </Button>
      </form>
    </>
  );
};