
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

      // Don't block on permission; request in background
      ensureNotificationPermission().catch(() => {});
      // Show missed notifications since last seen
      const lastSeenKey = `comments_last_seen_${user.id}`;
      try {
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
            for (const c of comments as any[]) {
              // Skip if it's our own comment
              if (c.user_id === user.id) continue;
              const taskTitle = tasks.find(t => t.id === c.task_id)?.title || 'Task';
              const actorName = c.created_by_name || 'Someone';
              const { title, body } = getTexts(actorName, taskTitle);

              const result = await platformNotificationManager.createNotification({
                title,
                body,
                tag: `comment-${c.id}`,
              });

              if (result.notification) {
                result.notification.onclick = () => {
                  window.focus();
                  window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: c.task_id } }));
                  result.notification?.close();
                };
              }

              toast({
                title,
                description: body,
              });
            }
          }
        }

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

            const result = await platformNotificationManager.createNotification({
              title,
              body,
              tag: `comment-${comment.id}`,
            });

            if (result.notification) {
              result.notification.onclick = () => {
                window.focus();
                window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: comment.task_id } }));
                result.notification?.close();
              };
            }

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
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            try {
              localStorage.setItem(`comments_last_seen_${user.id}`, new Date().toISOString());
            } catch (_) {}
          }
        });

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
