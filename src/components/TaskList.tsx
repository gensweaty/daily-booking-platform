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

export const TaskList = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const deleteTaskMutation = useMutation(deleteTask, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: (params: { id: string; updates: Partial<Task> }) =>
      updateTask(params.id, params.updates),
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
    const newStatus = result.destination.droppableId as 'todo' | 'in-progress' | 'done';

    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: newStatus },
    });
  };

  const getColumnStyle = (status: string) => {
    switch (status) {
      case 'in-progress':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
      case 'done':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
    }
  };

  const getTaskStyle = (status: string) => {
    switch (status) {
      case 'in-progress':
        return 'border-l-4 border-l-amber-500';
      case 'done':
        return 'border-l-4 border-l-green-500';
      default:
        return 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
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
            <Droppable key={status} droppableId={status}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`p-4 rounded-lg min-h-[200px] border ${getColumnStyle(status)}`}
                >
                  <h3 className="font-semibold mb-4 capitalize text-foreground">{status.replace('-', ' ')}</h3>
                  <div className="space-y-4">
                    {statusTasks.map((task: Task, index: number) => (
                      <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-4 bg-background dark:bg-gray-800 rounded-lg shadow ${getTaskStyle(task.status)}`}
                          >
                            <div className="flex justify-between items-start">
                              <div className={task.status === 'done' ? 'line-through text-gray-500' : 'text-foreground'}>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{task.title}</h3>
                                  <TaskFileIndicator taskId={task.id} />
                                </div>
                                {task.description && (
                                  <p className="text-foreground/80 mt-1 line-clamp-2">{task.description}</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setViewingTask(task)}
                                  className="text-foreground hover:text-foreground/80"
                                >
                                  <Maximize2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingTask(task)}
                                  className="text-foreground hover:text-foreground/80"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteTaskMutation.mutate(task.id)}
                                  className="text-foreground hover:text-foreground/80"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="bg-[#0A0A0B] border-gray-800 text-white">
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

// New component for file indicator
const TaskFileIndicator = ({ taskId }: { taskId: string }) => {
  const { data: files } = useQuery({
    queryKey: ['taskFiles', taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', taskId);
      return data || [];
    },
  });

  if (!files || files.length === 0) return null;

  return (
    <div className="flex items-center text-gray-600">
      <Paperclip className="h-4 w-4" />
      <span className="text-sm ml-1">{files.length}</span>
    </div>
  );
};
