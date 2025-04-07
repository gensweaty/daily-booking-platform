
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotes, updateNote, deleteNote } from "@/lib/api";
import { Note as DatabaseNote } from "@/types/database";
import { Note } from "@/lib/types";
import { useState } from "react";
import { useToast } from "./ui/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { NoteCard } from "./notes/NoteCard";
import { EditNoteDialog } from "./notes/EditNoteDialog";

// Helper function to convert between note types
const convertDatabaseToLibNote = (dbNote: DatabaseNote): Note => {
  return {
    id: dbNote.id,
    title: dbNote.title,
    content: dbNote.content || "",
    color: dbNote.color,
    user_id: dbNote.user_id,
    created_at: dbNote.created_at
  };
};

export const NoteList = () => {
  const { data: notesData = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: getNotes,
  });

  // Convert database notes to lib notes
  const notes: Note[] = notesData.map(convertDatabaseToLibNote);

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
    setEditContent(note.content || "");
    setEditColor(note.color || "#F2FCE2");
  };

  const handleSaveEdit = (updates: Partial<Note>) => {
    if (!editingNote) return;
    updateNoteMutation.mutate({
      id: editingNote.id,
      updates,
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(notes || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    queryClient.setQueryData(['notes'], items);
  };

  if (isLoading) return <div className="text-foreground">Loading notes...</div>;

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
              {(notes || []).map((note, index) => (
                <Draggable key={note.id} draggableId={note.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <NoteCard
                        note={{
                          ...note,
                          content: note.content || "" // Ensure content is always defined
                        }}
                        onEdit={handleEdit}
                        onDelete={() => deleteNoteMutation.mutate(note.id)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <EditNoteDialog
        note={editingNote ? {
          ...editingNote,
          content: editingNote.content || "" // Ensure content is always defined
        } : null}
        isOpen={!!editingNote}
        onClose={() => setEditingNote(null)}
        onSave={handleSaveEdit}
        editTitle={editTitle}
        editContent={editContent}
        editColor={editColor}
        setEditTitle={setEditTitle}
        setEditContent={setEditContent}
        setEditColor={setEditColor}
      />
    </>
  );
};
