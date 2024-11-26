import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotes, updateNote, deleteNote } from "@/lib/api";
import { Note } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useToast } from "./ui/use-toast";

export const NoteList = () => {
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: getNotes,
  });

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Note> }) =>
      updateNote(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ 
        title: "Success",
        description: "Note updated successfully" 
      });
      setEditingNote(null);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ 
        title: "Success",
        description: "Note deleted successfully" 
      });
    },
  });

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (!editingNote) return;
    updateNoteMutation.mutate({
      id: editingNote.id,
      updates: {
        title: editTitle,
        content: editContent,
      },
    });
  };

  if (isLoading) return <div>Loading notes...</div>;

  return (
    <>
      <div className="space-y-4">
        {notes?.map((note: Note) => (
          <div
            key={note.id}
            className="p-4 bg-white rounded-lg shadow border border-gray-200"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{note.title}</h3>
                <p className="text-gray-600 mt-2 whitespace-pre-wrap">{note.content}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(note)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteNoteMutation.mutate(note.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
        <DialogContent>
          <DialogTitle>Edit Note</DialogTitle>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Note title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Textarea
              placeholder="Note content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};