
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, updateTask, deleteTask } from "@/lib/api";
import { Task } from "@/lib/types";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { useToast } from "./ui/use-toast";
import { AddTaskForm } from "./AddTaskForm";
import { TaskFullView } from "./tasks/TaskFullView";
import { TaskColumn } from "./tasks/TaskColumn";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

export const TaskList = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: t("common.success"),
        description: t("common.deleteSuccess"),
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: t("common.success"),
        description: t("tasks.taskUpdated"),
      });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;
    
    // Convert from UI status format to database status format
    let dbStatus: 'todo' | 'inprogress' | 'done';
    
    if (newStatus === 'in-progress') {
      dbStatus = 'inprogress';
    } else {
      dbStatus = newStatus as 'todo' | 'done';
    }

    console.log(`Moving task ${taskId} to status: ${dbStatus}`);
    
    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: dbStatus },
    });
  };

  const handleDeleteClick = (id: string) => {
    setTaskToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete);
      setIsDeleteConfirmOpen(false);
      setTaskToDelete(null);
    }
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      console.log('Fetching tasks in TaskList component');
      const tasks = await getTasks();
      console.log('Tasks received in TaskList:', tasks);
      return tasks;
    },
  });

  if (isLoading) return <div className="text-foreground">Loading tasks...</div>;

  // Map database status to UI status
  const columns = {
    todo: tasks.filter((task: Task) => task.status === 'todo'),
    'in-progress': tasks.filter((task: Task) => task.status === 'inprogress'),
    done: tasks.filter((task: Task) => task.status === 'done'),
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(columns).map(([status, statusTasks]) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={statusTasks}
              onEdit={setEditingTask}
              onView={setViewingTask}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      </DragDropContext>

      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="bg-background border-border">
          <AddTaskForm 
            onClose={() => setEditingTask(null)} 
            editingTask={editingTask}
          />
        </DialogContent>
      </Dialog>

      {viewingTask && (
        <TaskFullView
          task={viewingTask}
          isOpen={!!viewingTask}
          onClose={() => setViewingTask(null)}
          onDelete={handleDeleteClick}
        />
      )}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("tasks.deleteTaskConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
