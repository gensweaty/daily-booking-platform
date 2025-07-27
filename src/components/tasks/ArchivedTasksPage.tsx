
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getArchivedTasks, restoreTask, deleteTask } from "@/lib/api";
import { Task } from "@/lib/types";
import { ArchivedTaskCard } from "./ArchivedTaskCard";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const ArchivedTasksPage = () => {
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadArchivedTasks();
  }, []);

  const loadArchivedTasks = async () => {
    try {
      setLoading(true);
      const tasks = await getArchivedTasks();
      setArchivedTasks(tasks);
    } catch (error) {
      console.error("Error loading archived tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load archived tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (taskId: string) => {
    try {
      await restoreTask(taskId);
      toast({
        title: "Success",
        description: "Task restored successfully",
      });
      loadArchivedTasks();
    } catch (error) {
      console.error("Error restoring task:", error);
      toast({
        title: "Error",
        description: "Failed to restore task",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast({
        title: "Success",
        description: "Task deleted permanently",
      });
      loadArchivedTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const handleClearAll = async () => {
    if (archivedTasks.length === 0) return;
    
    if (window.confirm("Are you sure you want to permanently delete all archived tasks?")) {
      try {
        await Promise.all(archivedTasks.map(task => deleteTask(task.id)));
        toast({
          title: "Success",
          description: "All archived tasks deleted",
        });
        loadArchivedTasks();
      } catch (error) {
        console.error("Error clearing archived tasks:", error);
        toast({
          title: "Error",
          description: "Failed to clear archived tasks",
          variant: "destructive",
        });
      }
    }
  };

  if (loading) {
    return <div className="p-6">Loading archived tasks...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Archived Tasks</h1>
        </div>
        
        {archivedTasks.length > 0 && (
          <Button
            variant="destructive"
            onClick={handleClearAll}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </Button>
        )}
      </div>

      {archivedTasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No archived tasks found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {archivedTasks.map((task) => (
            <ArchivedTaskCard
              key={task.id}
              task={task}
              onRestore={handleRestore}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
