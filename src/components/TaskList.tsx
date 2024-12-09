import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, updateTask, deleteTask } from "@/lib/api";
import { Task } from "@/lib/types";
import { useState } from "react";
import { useToast } from "./ui/use-toast";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { TaskColumn } from "./tasks/TaskColumn";

const COLUMNS = ["todo", "in-progress", "done"] as const;

export const TaskList = () => {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  });

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ 
        title: "Success",
        description: "Task updated successfully" 
      });
      setEditingTask(null);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ 
        title: "Success",
        description: "Task deleted successfully" 
      });
    },
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;
    const task = tasks.find((t: Task) => t.id === draggableId);

    if (task && source.droppableId !== destination.droppableId) {
      updateTaskMutation.mutate({
        id: task.id,
        updates: { status: destination.droppableId as Task["status"] },
      });
    }
  };

  if (isLoading) return <div className="text-foreground">Loading tasks...</div>;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-16rem)] overflow-y-auto">
        {COLUMNS.map((status) => (
          <Droppable key={status} droppableId={status}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="bg-muted/30 rounded-lg p-4 h-full"
              >
                <TaskColumn
                  status={status}
                  tasks={tasks.filter((task: Task) => task.status === status)}
                  onEdit={setEditingTask}
                  onDelete={(id) => deleteTaskMutation.mutate(id)}
                />
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
};