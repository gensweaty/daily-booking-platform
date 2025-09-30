
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, updateTask, deleteTask, archiveTask } from "@/lib/api";
import { Task } from "@/lib/types";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { useToast } from "./ui/use-toast";
import AddTaskForm from "./AddTaskForm";
import { TaskFullView } from "./tasks/TaskFullView";
import { TaskColumn } from "./tasks/TaskColumn";
import { TaskCardSkeleton } from "./tasks/TaskCardSkeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useTaskFilters } from "@/hooks/useTaskFilters";

interface TaskListProps {
  username?: string;
}

export const TaskList = ({ username }: TaskListProps = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { applyFilters, filters } = useTaskFilters(); // Must be called at top before any returns
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      // Broadcast change to public boards for this owner
      const ch = supabase.channel(`public_board_tasks_${user?.id}`);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'tasks-changed', payload: { ts: Date.now() } });
          supabase.removeChannel(ch);
        }
      });

      toast({
        title: t("common.success"),
        description: t("common.deleteSuccess"),
      });
    },
  });

  const archiveTaskMutation = useMutation({
    mutationFn: (id: string) => archiveTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archivedTasks'] });

      // Broadcast change to public boards for this owner
      const ch = supabase.channel(`public_board_tasks_${user?.id}`);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'tasks-changed', payload: { ts: Date.now() } });
          supabase.removeChannel(ch);
        }
      });

      toast({
        title: t("common.success"),
        description: t("tasks.taskArchived"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to archive task",
        variant: "destructive",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      updateTask(id, updates),
  onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // Broadcast change to public boards for this owner
      const ch = supabase.channel(`public_board_tasks_${user?.id}`);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'tasks-changed', payload: { ts: Date.now() } });
          supabase.removeChannel(ch);
        }
      });
      
      // Show celebration animation for completed tasks
      if (variables.updates.status === 'done') {
        toast({
          title: "🎉 Task Completed!",
          description: t("tasks.taskUpdated"),
        });
      } else {
        toast({
          title: t("common.success"),
          description: t("tasks.taskUpdated"),
        });
      }
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
      updates: { 
        status: dbStatus,
        last_edited_by_type: 'admin',
        last_edited_by_name: username || (user?.user_metadata?.full_name as string) || 'Admin',
        last_edited_at: new Date().toISOString()
      },
    });
  };

  const handleDeleteClick = (id: string) => {
    setTaskToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleArchiveClick = (id: string) => {
    archiveTaskMutation.mutate(id);
  };

  const handleDeleteConfirm = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete);
      setIsDeleteConfirmOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleEditFromView = (task: Task) => {
    setViewingTask(null);
    setEditingTask(task);
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(user?.id || ''),
    enabled: !!user?.id,
  });

  // Apply filters to tasks - MUST be before any early returns to follow hooks rules
  const filteredTasks = useMemo(() => {
    const nonArchived = tasks.filter((task: Task) => !task.archived);
    return applyFilters(nonArchived);
  }, [tasks, applyFilters]);
  
  const columns = useMemo(() => ({
    todo: filteredTasks.filter((task: Task) => task.status === 'todo'),
    'in-progress': filteredTasks.filter((task: Task) => task.status === 'inprogress'),
    done: filteredTasks.filter((task: Task) => task.status === 'done'),
  }), [filteredTasks]);

  // Realtime: keep task list in sync for this user (INSERT/UPDATE/DELETE)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`tasks-changes-user-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        console.log('[Realtime] tasks change for user', user.id, payload.eventType);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  useEffect(() => {
    const handler = async (e: CustomEvent) => {
      const taskId = (e as any).detail?.taskId as string | undefined;
      if (!taskId) return;

      // Try to find in current cache first
      let task = (tasks as Task[]).find((t) => t.id === taskId) || null;

      // If not present yet (page just loaded), fetch it directly
      if (!task) {
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .maybeSingle();
          if (!error && data) task = data as Task;
        } catch (_) {
          // ignore fetch failure
        }
      }

      if (task) setViewingTask(task);
    };
    window.addEventListener('open-task', handler as unknown as EventListener);

    // Also support deep link by query param ?openTask=ID
    const params = new URLSearchParams(window.location.search);
    const deepTaskId = params.get('openTask');
    if (deepTaskId) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: deepTaskId } }));
        // Clean the URL
        const url = new URL(window.location.href);
        url.searchParams.delete('openTask');
        window.history.replaceState({}, '', url.toString());
      }, 100);
    }

    return () => window.removeEventListener('open-task', handler as unknown as EventListener);
  }, [tasks]);

  // Loading skeleton
  if (isLoading) {
    return (
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {['todo', 'in-progress', 'done'].map((status, columnIndex) => (
          <motion.div
            key={status}
            className="p-4 rounded-xl border border-border/50 min-h-[400px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: columnIndex * 0.1 }}
          >
            {/* Column header skeleton */}
            <div className="flex items-center justify-between mb-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-muted rounded-full animate-pulse" />
                <div className="w-20 h-6 bg-muted rounded animate-pulse" />
              </div>
              <div className="w-8 h-6 bg-muted rounded-full animate-pulse" />
            </div>
            
            {/* Task cards skeleton */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <TaskCardSkeleton key={i} />
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
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

      <AnimatePresence>
        {editingTask && (
          <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
            <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[80vh] sm:max-h-[90vh] overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <AddTaskForm 
                  onClose={() => setEditingTask(null)} 
                  editingTask={editingTask}
                  username={username}
                />
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {viewingTask && (
        <TaskFullView
          task={viewingTask}
          isOpen={!!viewingTask}
          onClose={() => setViewingTask(null)}
          onDelete={handleDeleteClick}
          onEdit={handleEditFromView}
          onArchive={handleArchiveClick}
        />
      )}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
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
