import { Note } from "@/lib/types";
import { Pencil, Trash2, Paperclip } from "lucide-react";
import { Button } from "../ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

export const NoteCard = ({ note, onEdit, onDelete }: NoteCardProps) => {
  const { data: files } = useQuery({
    queryKey: ['noteFiles', note.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_files')
        .select('*')
        .eq('note_id', note.id);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div
      className="p-4 rounded-lg shadow transition-colors duration-200 border dark:border-gray-700"
      style={{ backgroundColor: note.color || "#F2FCE2" }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-900">{note.title}</h3>
            {files && files.length > 0 && (
              <div className="flex items-center text-gray-600">
                <Paperclip className="h-4 w-4" />
                <span className="text-sm ml-1">{files.length}</span>
              </div>
            )}
          </div>
          <div
            className="prose dark:prose-invert mt-2 text-gray-700 dark:text-gray-700 line-clamp-3"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        </div>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(note)}
            className="text-gray-700 dark:text-gray-700 hover:text-gray-900 dark:hover:text-gray-900 h-8 w-8"
            title="Edit note"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(note.id)}
            className="text-gray-700 dark:text-gray-700 hover:text-gray-900 dark:hover:text-gray-900 h-8 w-8"
            title="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};