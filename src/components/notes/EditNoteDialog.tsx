import { Note } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { FileUploadField } from "../shared/FileUploadField";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { FileDisplay } from "../shared/FileDisplay";

const COLORS = [
  { value: "#F2FCE2", label: "Green" },
  { value: "#FEF7CD", label: "Yellow" },
  { value: "#FEC6A1", label: "Orange" },
  { value: "#E5DEFF", label: "Purple" },
  { value: "#FFDEE2", label: "Pink" },
  { value: "#D3E4FD", label: "Blue" },
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
  const [fileError, setFileError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: existingFiles } = useQuery({
    queryKey: ['noteFiles', note?.id],
    queryFn: async () => {
      if (!note?.id) return [];
      const { data, error } = await supabase
        .from('note_files')
        .select('*')
        .eq('note_id', note.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!note?.id,
  });

  const handleSave = () => {
    onSave({ 
      title: editTitle, 
      content: editContent, 
      color: editColor 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border">
        <DialogTitle className="text-foreground">Edit Note</DialogTitle>
        <div className="space-y-4 mt-4">
          <Input
            placeholder="Note title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="bg-background border-input"
          />
          <Select value={editColor} onValueChange={setEditColor}>
            <SelectTrigger className="w-full bg-background border-input">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: editColor }} />
                  {COLORS.find(c => c.value === editColor)?.label || 'Select color'}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-background border-input">
              {COLORS.map((color) => (
                <SelectItem 
                  key={color.value} 
                  value={color.value}
                  className="hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: color.value }} />
                    {color.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div>
            <RichTextEditor
              content={editContent}
              onChange={setEditContent}
            />
          </div>
          {existingFiles && existingFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Current Attachments</Label>
              <FileDisplay 
                files={existingFiles} 
                bucketName="note_attachments"
                allowDelete
              />
            </div>
          )}
          <FileUploadField 
            onFileChange={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
          />
          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};