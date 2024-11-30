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
      <DialogContent className="bg-background border-border text-foreground max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-6 space-y-6">
          <div className="prose dark:prose-invert">
            <div className="p-4 rounded-lg border border-input bg-muted/50">
              <h3 className="text-sm font-medium mb-2">Description</h3>
              {task.description ? (
                <div 
                  className="whitespace-pre-wrap text-foreground/80"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
              ) : (
                <p className="text-muted-foreground">No description provided</p>
              )}
            </div>
          </div>
          {files && files.length > 0 && (
            <div className="p-4 rounded-lg border border-input bg-muted/50">
              <h3 className="text-sm font-medium mb-4">Attachments</h3>
              <FileDisplay files={files} bucketName="task_attachments" allowDelete />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};