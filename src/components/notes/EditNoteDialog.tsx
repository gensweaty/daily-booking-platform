import { Note } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useToast } from "../ui/use-toast";
import { FileDisplay } from "../shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";

const COLORS = [
  { value: "#F2FCE2", label: "Green" },
  { value: "#FEF7CD", label: "Yellow" },
  { value: "#FEC6A1", label: "Orange" },
  { value: "#E5DEFF", label: "Purple" },
  { value: "#FFDEE2", label: "Pink" },
  { value: "#D3E4FD", label: "Blue" },
];

const MAX_CHARS = 10000;
const MAX_FILE_SIZE_DOCS = 1024 * 1024; // 1MB
const MAX_FILE_SIZE_IMAGES = 2048 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
];

interface EditNoteDialogProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Note>) => void;
  editTitle: string;
  editContent: string;
  editColor: string;
  setEditTitle: (title: string) => void;
  setEditContent: (content: string) => void;
  setEditColor: (color: string) => void;
}

export const EditNoteDialog = ({
  note,
  isOpen,
  onClose,
  onSave,
  editTitle,
  editContent,
  editColor,
  setEditTitle,
  setEditContent,
  setEditColor,
}: EditNoteDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const { toast } = useToast();

  const { data: existingFiles } = useQuery({
    queryKey: ['noteFiles', note?.id],
    queryFn: async () => {
      if (!note) return null;
      const { data, error } = await supabase
        .from('note_files')
        .select('*')
        .eq('note_id', note.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!note,
  });

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

  const handleSave = async () => {
    try {
      // First save the note updates
      onSave({ title: editTitle, content: editContent, color: editColor });

      // If there's a file, upload it
      if (file && note) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('note_attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create file record in the database
        const { error: fileRecordError } = await supabase
          .from('note_files')
          .insert({
            note_id: note.id,
            filename: file.name,
            file_path: filePath,
            content_type: file.type,
            size: file.size,
            user_id: note.user_id
          });

        if (fileRecordError) throw fileRecordError;

        toast({
          title: "Success",
          description: "Note and file updated successfully",
        });
      }
    } catch (error: any) {
      console.error('Note update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update note. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="dark:bg-gray-800">
        <DialogTitle className="text-foreground">Edit Note</DialogTitle>
        <div className="space-y-4 mt-4">
          <Input
            placeholder="Note title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="dark:bg-gray-700 dark:text-gray-100"
          />
          <Select value={editColor} onValueChange={setEditColor}>
            <SelectTrigger className="w-full dark:bg-gray-700 dark:text-gray-100">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: editColor }} />
                  {COLORS.find(c => c.value === editColor)?.label || 'Select color'}
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
          <div>
            <Textarea
              placeholder="Note content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[200px] dark:bg-gray-700 dark:text-gray-100"
              maxLength={MAX_CHARS}
            />
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {editContent.length}/{MAX_CHARS} characters
            </div>
          </div>
          {existingFiles && existingFiles.length > 0 && (
            <div className="space-y-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <Label>Current Attachments</Label>
              <FileDisplay 
                files={existingFiles} 
                bucketName="note_attachments"
                allowDelete={true}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="file">Add Another Attachment (optional)</Label>
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
          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
