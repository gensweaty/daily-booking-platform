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
      await createNote({ 
        title, 
        content, 
        color,
        user_id: user.id 
      });
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
      <DialogTitle>Add New Note</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <Input
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="w-full">
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
        </div>
        <div>
          <Textarea
            placeholder="Note content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="min-h-[200px]"
            maxLength={MAX_CHARS}
          />
          <div className="text-sm text-gray-500 mt-1">
            {content.length}/{MAX_CHARS} characters
          </div>
        </div>
        <Button type="submit" className="w-full">Add Note</Button>
      </form>
    </>
  );
};