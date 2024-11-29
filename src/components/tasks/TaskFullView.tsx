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
      <DialogContent className="bg-background border-gray-800 text-foreground max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="prose dark:prose-invert">
            <p className="whitespace-pre-wrap text-foreground/80">{task.description}</p>
          </div>
          {files && files.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Attachments</h3>
              <FileDisplay files={files} bucketName="task_attachments" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};