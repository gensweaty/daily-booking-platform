import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task } from "@/lib/types";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
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
import { PresenceAvatars } from "@/components/PresenceAvatars";

interface PublicTaskListProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
  onlineUsers: { name: string; email: string }[];
}

export const PublicTaskList = ({ boardUserId, externalUserName, externalUserEmail, onlineUsers }: PublicTaskListProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
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

  useEffect(() => {
    const handler = async (e: CustomEvent) => {
      const taskId = (e as any).detail?.taskId as string | undefined;
      if (!taskId) return;

      // Try cached list first
      let task = (tasks as Task[]).find((t) => t.id === taskId) || null;

      // If not found, fetch latest tasks via RPC and open
      if (!task) {
        try {
          const { data } = await supabase.rpc('get_public_board_tasks', { board_user_id: boardUserId });
          const freshTasks = (data || []) as Task[];
          task = freshTasks.find((t) => t.id === taskId) || null;
        } catch (_) {
          // ignore fetch failure
        }
      }

      if (task) setViewingTask(task);
    };
    window.addEventListener('open-task', handler as unknown as EventListener);

    // Deep link support via ?openTask=ID
    const params = new URLSearchParams(window.location.search);
    const deepTaskId = params.get('openTask');
    if (deepTaskId) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: deepTaskId } }));
        const url = new URL(window.location.href);
        url.searchParams.delete('openTask');
        window.history.replaceState({}, '', url.toString());
      }, 100);
    }

    return () => window.removeEventListener('open-task', handler as unknown as EventListener);
  }, [tasks, boardUserId]);

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      // Add metadata tracking for external user edits
      const updatesWithMetadata = {
        ...updates,
        last_edited_by_type: 'external_user',
        last_edited_by_name: `${externalUserName} (Sub User)`,
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
      notifyBoardChange();
      
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

  // Broadcast channel for boards without DB realtime (anonymous)
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!boardUserId) return;
    const channelName = `public_board_tasks_${boardUserId}`;
    const ch = supabase
      .channel(channelName)
      .on('broadcast', { event: 'tasks-changed' }, () => {
        queryClient.invalidateQueries({ queryKey: ['publicTasks', boardUserId] });
      })
      .subscribe();
    broadcastChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      broadcastChannelRef.current = null;
    };
  }, [boardUserId, queryClient]);

  const notifyBoardChange = async () => {
    try {
      await broadcastChannelRef.current?.send({
        type: 'broadcast',
        event: 'tasks-changed',
        payload: { ts: Date.now() },
      });
    } catch (e) {
      console.error('Broadcast send failed', e);
    }
  };

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

// Map database status to UI status and sort by last edit descending (newest first at top)
  const getSortTime = (t: Task) => new Date(t.last_edited_at || t.updated_at || t.created_at).getTime();
  const columns = {
    todo: tasks.filter((task: Task) => task.status === 'todo').sort((a: Task, b: Task) => getSortTime(b) - getSortTime(a)),
    'in-progress': tasks.filter((task: Task) => task.status === 'inprogress').sort((a: Task, b: Task) => getSortTime(b) - getSortTime(a)),
    done: tasks.filter((task: Task) => task.status === 'done').sort((a: Task, b: Task) => getSortTime(b) - getSortTime(a)),
  };

  // External users should only be able to delete/edit their own tasks
  const canDeleteTask = (task: Task) => {
    return task.created_by_type === 'external_user' && 
           task.created_by_name === `${externalUserName} (Sub User)`;
  };

  const canEditTask = (task: Task) => {
    return task.created_by_type === 'external_user' && 
           task.created_by_name === `${externalUserName} (Sub User)`;
  };

  const handleDeleteTask = async (taskId: string) => {
    const task = tasks?.find(t => t.id === taskId);
    if (!task || !canDeleteTask(task)) {
      toast({
        title: t("common.error"),
        description: "You can only delete tasks you created",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          archived: true,
          archived_at: new Date().toISOString(),
          last_edited_by_type: 'external_user',
          last_edited_by_name: `${externalUserName} (Sub User)`,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('user_id', boardUserId);

      if (error) throw error;

      await queryClient.invalidateQueries({ 
        queryKey: ['publicTasks', boardUserId] 
      });
      notifyBoardChange();

      toast({
        title: t("common.success"),
        description: t("tasks.taskDeleted"),
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: t("common.error"),
        description: t("common.deleteError"),
        variant: "destructive",
      });
    }
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
        {/* Mobile: Header line with Tasks left, circles center, Add button right */}
        <div className="grid sm:hidden grid-cols-[auto_1fr_auto] items-center w-full">
          <h2 className="text-2xl font-bold text-foreground">{t('dashboard.tasks')}</h2>
          <div className="flex items-center justify-center">
            <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={2} />
          </div>
          <Button 
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:scale-105 active:scale-95 px-3 text-xs w-auto min-w-[80px] justify-self-end"
          >
            <Plus className="h-3 w-3" />
            <span>
              {isGeorgian ? 'დამატება' : 'Add'}
            </span>
          </Button>
        </div>

        {/* Desktop: Header with presence left of Add button */}
        <div className="hidden sm:flex flex-row items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-foreground">{t('dashboard.tasks')}</h2>
          <div className="flex items-center gap-3">
            <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={2} />
            <Button 
              onClick={() => setIsAddingTask(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:scale-105 active:scale-95 px-4 text-sm min-w-[120px]"
            >
              <Plus className="h-4 w-4" />
              <span>
                {t('tasks.addTask')}
              </span>
            </Button>
          </div>
        </div>

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
                onDelete={handleDeleteTask}
                isPublicBoard={true}
                canEditTask={canEditTask}
                canDeleteTask={canDeleteTask}
              />
            ))}
          </div>
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
                  externalUserEmail={externalUserEmail}
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
                  externalUserEmail={externalUserEmail}
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
          onEdit={canEditTask(viewingTask) ? handleEditFromView : undefined}
          onDelete={canDeleteTask(viewingTask) ? handleDeleteTask : undefined}
          externalUserName={externalUserName}
          externalUserEmail={externalUserEmail}
        />
      )}
    </>
  );
};