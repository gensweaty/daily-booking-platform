
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ensureNotificationPermission } from "@/utils/notificationUtils";
import { platformNotificationManager } from "@/utils/platformNotificationManager";

// Listen to new comments across all tasks owned by the authenticated user
export const CommentNotificationsListener: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getTexts = (name: string, task: string) => {
    switch (language) {
      case 'es':
        return { title: 'Nuevo comentario', body: `${name} comentó en "${task}"` };
      case 'ka':
        return { title: 'ახალი კომენტარი', body: `${name}-მა დატოვა კომენტარი "${task}"-ზე` };
      default:
        return { title: 'New comment', body: `${name} commented on "${task}"` };
    }
  };

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      if (!user) return;

      await ensureNotificationPermission();

      // Show missed notifications since last seen
      try {
        const lastSeenKey = `comments_last_seen_${user.id}`;
        const lastSeen = localStorage.getItem(lastSeenKey);

        // Fetch all task ids for this user first
        const { data: tasks, error: tasksErr } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('user_id', user.id);
        if (tasksErr) {
          console.error('[CommentsNotify] Error fetching tasks:', tasksErr);
        } else if (lastSeen && tasks && tasks.length) {
          const taskIdList = tasks.map(t => t.id);
          const { data: comments, error: cmErr } = await supabase
            .from('task_comments')
            .select('*')
            .in('task_id', taskIdList)
            .gt('created_at', lastSeen);
          if (!cmErr && comments && comments.length) {
            // Notify for each missed comment
            comments.forEach((c) => {
              // Skip if it's our own comment
              if (c.user_id === user.id) return;
              const taskTitle = tasks.find(t => t.id === c.task_id)?.title || 'Task';
              const actorName = c.created_by_name || 'Someone';
               const { title, body } = getTexts(actorName, taskTitle);

               platformNotificationManager.createNotification({
                 title,
                 body,
                 tag: `comment-${c.id}`,
               });

               toast({
                 title,
                 description: body,
               });
            });
          }
        }

        // Update last seen to now
        localStorage.setItem(lastSeenKey, new Date().toISOString());
      } catch (e) {
        console.error('[CommentsNotify] Missed notifications check failed:', e);
      }

      // Realtime subscription to task_comments
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel('task-comments-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments' }, async (payload) => {
          if (!isMounted || !payload?.new) return;
          const comment: any = payload.new;

          try {
            // Ensure this comment is for a task owned by the user
            const { data: task, error: taskErr } = await supabase
              .from('tasks')
              .select('id, title, user_id')
              .eq('id', comment.task_id)
              .maybeSingle();
            if (taskErr || !task || task.user_id !== user.id) return;

            // Ignore own comments
            if (comment.user_id === user.id) return;

            const actorName = comment.created_by_name || 'Someone';
            const { title, body } = getTexts(actorName, task.title || 'Task');

            platformNotificationManager.createNotification({
              title,
              body,
              tag: `comment-${comment.id}`,
            });

            toast({
              title,
              description: body,
            });

            // Update last seen time on every incoming notification
            localStorage.setItem(`comments_last_seen_${user.id}`, new Date().toISOString());
          } catch (err) {
            console.error('[CommentsNotify] Realtime notification error:', err);
          }
        })
        .subscribe();

      channelRef.current = channel;
    };

    setup();

    return () => {
      isMounted = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user?.id]);

  return null;
};
