import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Task } from "@/lib/types";
import { FileDisplay } from "../shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface TaskFullViewProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskFullView = ({ task, isOpen, onClose }: TaskFullViewProps) => {
  const { data: files } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0A0A0B] border-gray-800 text-white max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <div className="prose dark:prose-invert">
            <p className="whitespace-pre-wrap text-gray-300">{task.description}</p>
          </div>
          {files && files.length > 0 && (
            <FileDisplay files={files} bucketName="task_attachments" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};