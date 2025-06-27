import { useState, useEffect } from "react";
import { TaskColumn } from "./tasks/TaskColumn";
import { AddTaskForm } from "./AddTaskForm";
import { Button } from "@/components/ui/button";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, deleteTask, getTasks, updateTask } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Task, Task as TaskType } from "@/lib/types";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { TaskFullView } from "./tasks/TaskFullView";
import { PlusCircle, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "./shared/LanguageText";

export const TaskList = () => {
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: tasks, isLoading, isError } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: () => getTasks(),
    enabled: !!user?.id,
  });

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: t("common.success"),
        description: t("tasks.taskAdded"),
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: (task: { id: string; data: Partial<Task> }) =>
      updateTask(task.id, task.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: t("common.success"),
        description: t("tasks.taskUpdated"),
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: t("common.success"),
        description: t("tasks.taskDeleted"),
      });
    },
  });

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const taskId = draggableId;
    const newStatus = destination.droppableId as 'todo' | 'in-progress' | 'done';
    const newPosition = destination.index;

    // Optimistically update the task's status and position
    queryClient.setQueryData<TaskType[]>(['tasks', user?.id], (oldTasks) => {
      if (!oldTasks) return [];

      const updatedTasks = oldTasks.map((task) => {
        if (task.id === taskId) {
          return { ...task, status: newStatus, position: newPosition };
        }
        return task;
      });
      return updatedTasks;
    });

    try {
      await updateTaskMutation.mutateAsync({
        id: taskId,
        data: { status: newStatus, position: newPosition },
      });
    } catch (error) {
      toast({
        title: "Error",
        description: t("tasks.taskUpdateFailed"),
        variant: "destructive",
      });
    }
  };

  const handleAddTask = async (taskData: Omit<Task, 'id'>) => {
    createTaskMutation.mutate(taskData);
    setIsAddFormOpen(false);
  };

  const handleUpdateTask = async (id: string, taskData: Partial<Task>) => {
    updateTaskMutation.mutate({ id, data: taskData });
    setIsAddFormOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = async (id: string) => {
    deleteTaskMutation.mutate(id);
  };

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (isError) return <div>{t("common.error")}</div>;

  const todoTasks = tasks
    ?.filter((task) => task.status === 'todo' && task.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position);
  const inProgressTasks = tasks
    ?.filter((task) => task.status === 'in-progress' && task.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position);
  const doneTasks = tasks
    ?.filter((task) => task.status === 'done' && task.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t("tasks.title")}</h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              <LanguageText>{t("tasks.addTask")}</LanguageText>
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" side="right">
            <AddTaskForm onClose={() => setIsAddFormOpen(false)} editingTask={editingTask} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="relative">
        <Input
          type="search"
          placeholder={t("tasks.searchTasks")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
      </div>

      <div className="bg-background p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">{t("tasks.taskList")}</h3>
          <Label htmlFor="search">{t("tasks.search")}</Label>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TaskColumn
              status="todo"
              tasks={todoTasks || []}
              onEdit={(task) => {
                setEditingTask(task);
                setIsAddFormOpen(true);
              }}
              onView={(task) => setViewingTask(task)}
              onDelete={handleDeleteTask}
            />
            <TaskColumn
              status="in-progress"
              tasks={inProgressTasks || []}
              onEdit={(task) => {
                setEditingTask(task);
                setIsAddFormOpen(true);
              }}
              onView={(task) => setViewingTask(task)}
              onDelete={handleDeleteTask}
            />
            <TaskColumn
              status="done"
              tasks={doneTasks || []}
              onEdit={(task) => {
                setEditingTask(task);
                setIsAddFormOpen(true);
              }}
              onView={(task) => setViewingTask(task)}
              onDelete={handleDeleteTask}
            />
          </div>
        </DragDropContext>
      </div>

      {/* Task Full View Dialog */}
      {viewingTask && (
        <TaskFullView
          task={viewingTask}
          isOpen={true}
          onClose={() => setViewingTask(null)}
          onDelete={handleDeleteTask}
          onEdit={(task) => {
            setEditingTask(task);
            setViewingTask(null);
            setIsAddFormOpen(true);
          }}
        />
      )}

      <Sheet open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
        <SheetContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" side="right">
          <AddTaskForm
            onClose={() => {
              setIsAddFormOpen(false);
              setEditingTask(null);
            }}
            editingTask={editingTask}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};
