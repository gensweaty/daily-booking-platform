import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createNote } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const noteColors = [
  { value: "bg-white", label: "White" },
  { value: "bg-yellow-50", label: "Yellow" },
  { value: "bg-green-50", label: "Green" },
  { value: "bg-blue-50", label: "Blue" },
  { value: "bg-purple-50", label: "Purple" },
  { value: "bg-pink-50", label: "Pink" },
];

export const AddNoteForm = ({ onClose }: { onClose: () => void }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("bg-white");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createNote({ title, content, color });
      await queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({
        title: "Success",
        description: "Note created successfully",
      });
      onClose();
    } catch (error) {
      console.error('Note creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
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
          <Textarea
            placeholder="Note content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="min-h-[200px]"
          />
        </div>
        <div>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger>
              <SelectValue placeholder="Select note color" />
            </SelectTrigger>
            <SelectContent>
              {noteColors.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${color.value}`} />
                    {color.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Add Note</Button>
      </form>
    </>
  );
};