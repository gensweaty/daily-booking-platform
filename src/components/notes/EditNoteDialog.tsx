import { Note } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

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
  const MAX_CHARS = 10000;

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
          <Button onClick={() => onSave({ title: editTitle, content: editContent, color: editColor })} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};