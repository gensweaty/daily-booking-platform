import { Note } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { FileUploadField } from "../shared/FileUploadField";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useState } from "react";

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

  const handleSave = () => {
    onSave({ 
      title: editTitle, 
      content: editContent, 
      color: editColor 
    });
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
            <RichTextEditor
              content={editContent}
              onChange={setEditContent}
            />
          </div>
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