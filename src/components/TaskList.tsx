import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, updateTask, deleteTask } from "@/lib/api";
import { Task } from "@/lib/types";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { useToast } from "./ui/use-toast";

export const TaskList = () => {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  });

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as 'todo' | 'in-progress' | 'done';

    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: newStatus },
    });
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
  };

  const handleSaveEdit = () => {
    if (!editingTask) return;
    updateTaskMutation.mutate({
      id: editingTask.id,
      updates: {
        title: editTitle,
        description: editDescription,
      },
    });
  };

  if (isLoading) return <div>Loading tasks...</div>;

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
                  className="bg-gray-50 p-4 rounded-lg min-h-[200px]"
                >
                  <h3 className="font-semibold mb-4 capitalize">{status.replace('-', ' ')}</h3>
                  <div className="space-y-4">
                    {statusTasks.map((task: Task, index: number) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="p-4 bg-white rounded-lg shadow border border-gray-200"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold">{task.title}</h3>
                                {task.description && (
                                  <p className="text-gray-600 mt-1">{task.description}</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(task)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteTaskMutation.mutate(task.id)}
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
        <DialogContent>
          <DialogTitle>Edit Task</DialogTitle>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Task title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};