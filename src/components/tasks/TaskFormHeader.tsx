import { DialogTitle } from "@/components/ui/dialog";
import { Task } from "@/lib/types";

interface TaskFormHeaderProps {
  editingTask: Task | null;
}

export const TaskFormHeader = ({ editingTask }: TaskFormHeaderProps) => {
  return (
    <DialogTitle className="text-foreground">
      {editingTask ? 'Edit Task' : 'Add New Task'}
    </DialogTitle>
  );
};