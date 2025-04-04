import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createNote } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { FileUploadField } from "./shared/FileUploadField";

const MAX_CHARS = 10000;
const COLORS = [
  { value: "#F2FCE2", label: "Green" },
  { value: "#FEF7CD", label: "Yellow" },
  { value: "#FEC6A1", label: "Orange" },
  { value: "#E5DEFF", label: "Purple" },
  { value: "#FFDEE2", label: "Pink" },
  { value: "#D3E4FD", label: "Blue" },
];

export const AddNoteForm = ({ onClose }: { onClose: () => void }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState(COLORS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate("/signin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.length > MAX_CHARS) {
      toast({
        title: "Error",
        description: `Content exceeds maximum length of ${MAX_CHARS} characters`,
        variant: "destructive",
      });
      return;
    }
    try {
      const newNote = await createNote({ 
        title, 
        content, 
        color,
        user_id: user.id 
      });

      if (file && newNote) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('note_attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: fileRecordError } = await supabase
          .from('note_files')
          .insert({
            note_id: newNote.id,
            filename: file.name,
            file_path: filePath,
            content_type: file.type,
            size: file.size,
            user_id: user.id
          });

        if (fileRecordError) throw fileRecordError;
      }

      await queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({
        title: "Success",
        description: "Note created successfully",
      });
      onClose();
    } catch (error: any) {
      console.error('Note creation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create note. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DialogTitle className="text-foreground">Add New Note</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <Input
          placeholder="Note title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="bg-background border-gray-700"
        />
        <Select value={color} onValueChange={setColor}>
          <SelectTrigger className="w-full bg-background border-gray-700">
            <SelectValue>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                {COLORS.find(c => c.value === color)?.label || 'Select color'}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COLORS.map((color) => (
              <SelectItem key={color.value} value={color.value}>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: color.value }} />
                  {color.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          placeholder="Note content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          className="min-h-[200px] bg-background border-gray-700"
          maxLength={MAX_CHARS}
        />
        <div className="text-sm text-muted-foreground">
          {content.length}/{MAX_CHARS} characters
        </div>
        <FileUploadField
          onFileChange={setFile}
          fileError={fileError}
          setFileError={setFileError}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Add Note</Button>
      </form>
    </>
  );
};