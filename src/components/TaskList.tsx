import { useQuery } from "@tanstack/react-query";
import { DragDropContext } from "@hello-pangea/dnd";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { TaskColumn } from "./TaskList/TaskColumn";
import { TaskStatus } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

export const TaskList = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: tasks, refetch } = useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user?.id)
        .order("position");

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const columns = tasks?.reduce(
    (acc, task) => {
      if (!acc[task.status]) {
        acc[task.status] = [];
      }
      acc[task.status].push(task);
      return acc;
    },
    { todo: [], "in-progress": [], done: [] } as Record<TaskStatus, typeof tasks>
  );

  const handleDragEnd = async (result: any) => {
    if (!result.destination || !tasks) return;

    const { source, destination } = result;

    // Get the moved task
    const sourceColumn = columns[source.droppableId as TaskStatus];
    const [movedTask] = sourceColumn.splice(source.index, 1);
    const destColumn = columns[destination.droppableId as TaskStatus];
    destColumn.splice(destination.index, 0, movedTask);

    // Update positions in the destination column
    const updates = destColumn.map((task, index) => ({
      id: task.id,
      position: index,
      status: destination.droppableId,
    }));

    try {
      await supabase.from("tasks").upsert(updates);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error updating task position",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-[calc(100vh-18rem)]">
          {Object.entries(columns).map(([status, statusTasks]) => (
            <TaskColumn
              key={status}
              status={status as TaskStatus}
              tasks={statusTasks}
            />
          ))}
        </div>
      </DragDropContext>
    </>
  );
};