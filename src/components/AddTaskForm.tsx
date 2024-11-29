import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTask } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const MAX_FILE_SIZE_DOCS = 1024 * 1024; // 1MB
const MAX_FILE_SIZE_IMAGES = 2048 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
];

export const AddTaskForm = ({ onClose }: { onClose: () => void }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const validateFile = (file: File) => {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
    
    if (!isImage && !isDoc) {
      return "Invalid file type. Please upload an image (jpg, jpeg, png, webp) or document (pdf, docx, xlsx, pptx)";
    }

    const maxSize = isImage ? MAX_FILE_SIZE_IMAGES : MAX_FILE_SIZE_DOCS;
    if (file.size > maxSize) {
      return `File size exceeds ${maxSize / (1024 * 1024)}MB limit`;
    }

    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFileError("");

    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        setFileError(error);
        setFile(null);
        return;
      }
      setFile(selectedFile);
    }
  };

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
      // First create the task
      const newTask = await createTask({ 
        title, 
        description, 
        status: 'todo',
        user_id: user.id
      });

      // If there's a file, upload it
      if (file && newTask) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task_attachments')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        // Create file record in the database
        const { error: fileRecordError } = await supabase
          .from('files')
          .insert({
            task_id: newTask.id,
            filename: file.name,
            file_path: filePath,
            content_type: file.type,
            size: file.size,
            user_id: user.id
          });

        if (fileRecordError) {
          throw fileRecordError;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      onClose();
    } catch (error: any) {
      console.error('Task creation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create task. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DialogTitle>Add New Task</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[150px]" // Made 3 times bigger
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="file">Attachment (optional)</Label>
          <Input
            id="file"
            type="file"
            onChange={handleFileChange}
            accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES].join(",")}
            className="cursor-pointer"
          />
          {fileError && (
            <p className="text-sm text-red-500 mt-1">{fileError}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Max size: Images - 2MB, Documents - 1MB
            <br />
            Supported formats: Images (jpg, jpeg, png, webp), Documents (pdf, docx, xlsx, pptx)
          </p>
        </div>
        <Button type="submit" className="w-full">Add Task</Button>
      </form>
    </>
  );
};