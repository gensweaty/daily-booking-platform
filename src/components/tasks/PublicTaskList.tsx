import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task } from "@/lib/types";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { PublicAddTaskForm } from "./PublicAddTaskForm";
import { TaskFullView } from "./TaskFullView";
import { TaskColumn } from "./TaskColumn";
import { TaskCardSkeleton } from "./TaskCardSkeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PublicTaskListProps {
  boardUserId: string;
  externalUserName: string;
}

export const PublicTaskList = ({ boardUserId, externalUserName }: PublicTaskListProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Fetch tasks using the security definer function
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['publicTasks', boardUserId],
    queryFn: async () => {
      console.log('Fetching public board tasks for user:', boardUserId);
      const { data, error } = await supabase
        .rpc('get_public_board_tasks', { board_user_id: boardUserId });
      
      if (error) {
        console.error('Error fetching public board tasks:', error);
        throw error;
      }
      
      console.log('Fetched tasks:', data);
      return data || [];
    },
    enabled: !!boardUserId,
    // Remove frontend auto-refresh to avoid constant reloads
    refetchInterval: false,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      // Add metadata tracking for external user edits
      const updatesWithMetadata = {
        ...updates,
        last_edited_by_type: 'external_user',
        last_edited_by_name: externalUserName,
        last_edited_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('tasks')
        .update(updatesWithMetadata)
        .eq('id', id)
        .eq('user_id', boardUserId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['publicTasks', boardUserId] });
      
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
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to update task",
        variant: "destructive",
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

  const handleEditFromView = (task: Task) => {
    setViewingTask(null);
    setEditingTask(task);
  };

  // Set up real-time subscription for task changes
  useEffect(() => {
    if (!boardUserId) return;

    console.log('Setting up real-time subscription for user:', boardUserId);
    
    const channel = supabase
      .channel('public_tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${boardUserId}`,
        },
        (payload) => {
          console.log('Real-time task change detected:', payload);
          // Invalidate and refetch tasks when changes occur
          queryClient.invalidateQueries({ queryKey: ['publicTasks', boardUserId] });
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [boardUserId, queryClient]);

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

  // Map database status to UI status
  const columns = {
    todo: tasks.filter((task: Task) => task.status === 'todo'),
    'in-progress': tasks.filter((task: Task) => task.status === 'inprogress'),
    done: tasks.filter((task: Task) => task.status === 'done'),
  };

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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-foreground">{t('dashboard.tasks')}</h2>
          <Button 
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t('tasks.addTask')}
          </Button>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {Object.entries(columns).map(([status, statusTasks]) => (
              <TaskColumn
                key={status}
                status={status}
                tasks={statusTasks}
                onEdit={setEditingTask}
                onView={setViewingTask}
                onDelete={() => {}} // External users cannot delete
                isPublicBoard={true}
              />
            ))}
          </motion.div>
        </DragDropContext>
      </div>

      <AnimatePresence>
        {isAddingTask && (
          <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
            <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[80vh] sm:max-h-[90vh] overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <PublicAddTaskForm 
                  onClose={() => setIsAddingTask(false)} 
                  boardUserId={boardUserId}
                  externalUserName={externalUserName}
                />
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

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
                <PublicAddTaskForm 
                  onClose={() => setEditingTask(null)} 
                  editingTask={editingTask}
                  boardUserId={boardUserId}
                  externalUserName={externalUserName}
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
          onEdit={handleEditFromView}
        />
      )}
    </>
  );
};