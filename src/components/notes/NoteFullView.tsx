
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Note } from "@/lib/types";
import { FileDisplay } from "../shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface NoteFullViewProps {
  note: Note;
  isOpen: boolean;
  onClose: () => void;
}

export const NoteFullView = ({ note, isOpen, onClose }: NoteFullViewProps) => {
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-gray-800 text-foreground max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{note.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="prose dark:prose-invert">
            <p className="whitespace-pre-wrap text-foreground/80">{note.content}</p>
          </div>
          {files && files.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Attachments</h3>
              <FileDisplay 
                files={files} 
                bucketName="note_attachments"
                parentType="note"
                parentId={note.id}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
