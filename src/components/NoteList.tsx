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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const MAX_CHARS = 10000;
const COLORS = [
  { value: "#F2FCE2", label: "Green" },
  { value: "#FEF7CD", label: "Yellow" },
  { value: "#FEC6A1", label: "Orange" },
  { value: "#E5DEFF", label: "Purple" },
  { value: "#FFDEE2", label: "Pink" },
  { value: "#D3E4FD", label: "Blue" },
];

export const NoteList = () => {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: getNotes,
  });

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editColor, setEditColor] = useState("");
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
    setEditColor(note.color || COLORS[0].value);
  };

  const handleSaveEdit = () => {
    if (!editingNote) return;
    if (editContent.length > MAX_CHARS) {
      toast({
        title: "Error",
        description: `Content exceeds maximum length of ${MAX_CHARS} characters`,
        variant: "destructive",
      });
      return;
    }
    updateNoteMutation.mutate({
      id: editingNote.id,
      updates: {
        title: editTitle,
        content: editContent,
        color: editColor,
      },
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(notes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update the notes in the UI immediately
    queryClient.setQueryData(['notes'], items);
  };

  if (isLoading) return <div>Loading notes...</div>;

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="notes">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {notes?.map((note: Note, index: number) => (
                <Draggable key={note.id} draggableId={note.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="p-4 rounded-lg shadow border border-gray-200 transition-colors duration-200"
                      style={{ 
                        backgroundColor: note.color || COLORS[0].value,
                        ...provided.draggableProps.style
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
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
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent>
          <DialogTitle>Edit Note</DialogTitle>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Note title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Select value={editColor} onValueChange={setEditColor}>
              <SelectTrigger className="w-full">
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
                className="min-h-[200px]"
                maxLength={MAX_CHARS}
              />
              <div className="text-sm text-gray-500 mt-1">
                {editContent.length}/{MAX_CHARS} characters
              </div>
            </div>
            <Button onClick={handleSaveEdit} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};