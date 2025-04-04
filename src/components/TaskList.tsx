
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, updateTask, deleteTask } from "@/lib/api";
import { Task } from "@/lib/types";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useState } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { useToast } from "./ui/use-toast";
import { AddTaskForm } from "./AddTaskForm";
import { TaskFullView } from "./tasks/TaskFullView";
import { TaskColumn } from "./tasks/TaskColumn";
import { useAuth } from "@/contexts/AuthContext";

export const TaskList = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const { user } = useAuth();

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      // CRITICAL FIX: Remove user_id from updates to prevent ownership changes
      const safeUpdates = { ...updates };
      if ('user_id' in safeUpdates) {
        delete safeUpdates.user_id;
        console.warn("Prevented attempt to change user_id during task update in TaskList");
      }
      return updateTask(id, safeUpdates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
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

  // CRITICAL FIX: Added user id to query key for proper caching and added additional logging
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', user?.id], // Added user id to query key
    queryFn: async () => {
      console.log('Fetching tasks in TaskList component for user:', user?.id);
      
      if (!user?.id) {
        console.error('No user ID available for fetching tasks');
        return [] as Task[];
      }
      
      const tasks = await getTasks();
      console.log('Tasks received in TaskList:', tasks);
      
      // Additional validation to ensure we only have tasks for the current user
      if (tasks && tasks.length > 0) {
        const invalidTasks = tasks.filter(task => task.user_id !== user.id);
        if (invalidTasks.length > 0) {
          console.error("CRITICAL DATA ISOLATION BREACH: TaskList received tasks from other users:", 
            invalidTasks.map(t => ({ id: t.id, user_id: t.user_id, title: t.title }))
          );
          // Filter out the tasks that don't belong to the current user
          return tasks.filter(task => task.user_id === user.id) as Task[];
        }
      }
      
      return tasks as Task[];
    },
    enabled: !!user, // Only run query when user is available
  });

  if (isLoading) return <div className="text-foreground">Loading tasks...</div>;

  // Type assertion to ensure tasks is treated as Task[]
  const taskList = tasks as Task[];
  
  // Final check to ensure we only show tasks for the current user
  const filteredTasks = user?.id 
    ? taskList.filter(task => task.user_id === user.id)
    : [];
  
  if (filteredTasks.length !== taskList.length) {
    console.error(`FILTERED OUT ${taskList.length - filteredTasks.length} tasks that didn't belong to user ${user?.id}`);
  }
  
  const columns = {
    todo: filteredTasks.filter((task: Task) => task.status === 'todo'),
    'inprogress': filteredTasks.filter((task: Task) => task.status === 'inprogress'),
    done: filteredTasks.filter((task: Task) => task.status === 'done'),
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
