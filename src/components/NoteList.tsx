import { useQuery } from "@tanstack/react-query";
import { getNotes } from "@/lib/api";
import { Note } from "@/lib/types";

export const NoteList = () => {
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: getNotes,
  });

  if (isLoading) return <div>Loading notes...</div>;

  return (
    <div className="space-y-4">
      {notes?.map((note: Note) => (
        <div
          key={note.id}
          className="p-4 bg-white rounded-lg shadow border border-gray-200"
        >
          <h3 className="font-semibold">{note.title}</h3>
          <p className="text-gray-600 mt-2 whitespace-pre-wrap">{note.content}</p>
        </div>
      ))}
    </div>
  );
};