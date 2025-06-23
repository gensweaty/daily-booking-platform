
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Task } from "@/lib/types";
import { FileDisplay } from "../shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "../ui/button";
import { AlertCircle, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { TaskDateInfo } from "./TaskDateInfo";

interface TaskFullViewProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export const TaskFullView = ({ task, isOpen, onClose, onDelete }: TaskFullViewProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  useEffect(() => {
    console.log("TaskFullView - task received:", task);
  }, [task]);

  const { data: files, refetch } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      
      if (error) throw error;
      console.log("Retrieved task files:", data);
      return data;
    },
    enabled: isOpen && !!task.id,
  });

  const handleFileDeleted = () => {
    refetch();
    toast({
      title: "Success",
      description: "File deleted successfully",
    });
  };

  const handleDeleteClick = () => {
    if (onDelete) {
      setIsDeleteConfirmOpen(true);
    }
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete(task.id);
      setIsDeleteConfirmOpen(false);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-background border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
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

            {/* Deadline and Reminder Info */}
            {(task.deadline_at || task.reminder_at) && (
              <div className="p-4 rounded-lg border border-input bg-muted/50">
                <h3 className="text-sm font-medium mb-2">Schedule</h3>
                <TaskDateInfo deadline={task.deadline_at} reminder={task.reminder_at} />
              </div>
            )}

            {files && files.length > 0 && (
              <div className="p-4 rounded-lg border border-input bg-muted/50">
                <FileDisplay 
                  files={files} 
                  bucketName="event_attachments" 
                  allowDelete 
                  onFileDeleted={handleFileDeleted}
                  parentId={task.id}
                  parentType="task"
                />
              </div>
            )}

            {onDelete && (
              <div className="flex justify-end">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDeleteClick}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Task
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
