import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, updateTask, deleteTask } from "@/lib/api";
import { Task } from "@/lib/types";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Pencil, Trash2, Maximize2, Paperclip } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { useToast } from "./ui/use-toast";
import { AddTaskForm } from "./AddTaskForm";
import { TaskFullView } from "./tasks/TaskFullView";
import { supabase } from "@/lib/supabase";
import { TaskColumn } from "./tasks/TaskColumn";
import { TaskCard } from "./tasks/TaskCard";

export const TaskList = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as 'todo' | 'inprogress' | 'done';

    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: newStatus },
    });
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

  const columns = {
    todo: tasks.filter((task: Task) => task.status === 'todo'),
    'in-progress': tasks.filter((task: Task) => task.status === 'in-progress'),
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
              onDelete={(id) => deleteTaskMutation.mutate(id)}
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
        />
      )}
    </>
  );
};
