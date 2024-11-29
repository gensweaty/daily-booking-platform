import { Note } from "@/lib/types";
import { Pencil, Trash2, Maximize2 } from "lucide-react";
import { Button } from "../ui/button";
import { useState } from "react";
import { NoteFullView } from "./NoteFullView";

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

export const NoteCard = ({ note, onEdit, onDelete }: NoteCardProps) => {
  const [isFullView, setIsFullView] = useState(false);

  return (
    <>
      <div
        className="p-4 rounded-lg shadow transition-colors duration-200 border dark:border-gray-700"
        style={{ backgroundColor: note.color || "#F2FCE2" }}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-900">{note.title}</h3>
            <p className="text-gray-700 dark:text-gray-700 mt-2 whitespace-pre-wrap line-clamp-3">{note.content}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullView(true)}
              className="text-gray-700 dark:text-gray-700 hover:text-gray-900 dark:hover:text-gray-900"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(note)}
              className="text-gray-700 dark:text-gray-700 hover:text-gray-900 dark:hover:text-gray-900"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(note.id)}
              className="text-gray-700 dark:text-gray-700 hover:text-gray-900 dark:hover:text-gray-900"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <NoteFullView
        note={note}
        isOpen={isFullView}
        onClose={() => setIsFullView(false)}
      />
    </>
  );
};