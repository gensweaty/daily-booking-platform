import { useEffect, useRef } from "react";
import { supabase as publicSupabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ensureNotificationPermission } from "@/utils/notificationUtils";
import { platformNotificationManager } from "@/utils/platformNotificationManager";

interface Props {
  boardUserId: string;
  externalUserName: string;
}

// Listen to new comments for the current sub-user's tasks on the Public Board
export const PublicCommentNotificationsListener: React.FC<Props> = ({ boardUserId, externalUserName }) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const channelRef = useRef<ReturnType<typeof publicSupabase.channel> | null>(null);
  const tasksMapRef = useRef<Map<string, { title: string }>>(new Map());

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
      if (!boardUserId || !externalUserName) return;

      ensureNotificationPermission().catch(() => {});

      const subUserLabel = `${externalUserName} (Sub User)`;
      const lastSeenKey = `public_comments_last_seen_${boardUserId}_${externalUserName}`;

      // 1) Load tasks for this sub-user using RPC that bypasses RLS
      try {
        const { data: tasksData, error: tasksErr } = await publicSupabase
          .rpc('get_public_board_tasks', { board_user_id: boardUserId });
        if (tasksErr) {
          console.error('[PublicCommentsNotify] Error fetching tasks via RPC:', tasksErr);
        } else if (tasksData && tasksData.length) {
          // Keep only this sub-user's tasks
          const ownTasks = tasksData.filter((t: any) => t.created_by_type === 'external_user' && t.created_by_name === subUserLabel);
          tasksMapRef.current = new Map(ownTasks.map((t: any) => [t.id, { title: t.title || 'Task' }]));
        }
      } catch (e) {
        console.error('[PublicCommentsNotify] Failed loading tasks:', e);
      }

      // 2) Missed notifications since last seen
      try {
        const lastSeen = localStorage.getItem(lastSeenKey);
        const taskIds = Array.from(tasksMapRef.current.keys());
        if (lastSeen && taskIds.length) {
          const { data: comments, error: cmErr } = await publicSupabase
            .from('task_comments')
            .select('*')
            .in('task_id', taskIds)
            .gt('created_at', lastSeen);

          if (!cmErr && comments && comments.length) {
            for (const c of (comments as any[])) {
              if (c.created_by_name === subUserLabel) continue;
              const taskTitle = tasksMapRef.current.get(c.task_id)?.title || 'Task';
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
        console.error('[PublicCommentsNotify] Missed notifications check failed:', e);
      }

      // 3) Realtime subscription to task_comments
      if (channelRef.current) publicSupabase.removeChannel(channelRef.current);

      const channel = publicSupabase
        .channel(`public-task-comments-${boardUserId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments' }, async (payload) => {
          if (!isMounted || !payload?.new) return;
          const comment: any = payload.new;

          // Only notify if this comment is for current sub-user's task and not authored by them
          if (!tasksMapRef.current.has(comment.task_id)) return;
          if (comment.created_by_name === subUserLabel) return;

          const taskTitle = tasksMapRef.current.get(comment.task_id)?.title || 'Task';
          const actorName = comment.created_by_name || 'Someone';
          const { title, body } = getTexts(actorName, taskTitle);

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

          // Update last seen on every incoming notification
          localStorage.setItem(lastSeenKey, new Date().toISOString());
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            try {
              localStorage.setItem(lastSeenKey, new Date().toISOString());
            } catch (_) {}
          }
        });

      channelRef.current = channel;
    };

    setup();

    return () => {
      isMounted = false;
      if (channelRef.current) publicSupabase.removeChannel(channelRef.current);
    };
  }, [boardUserId, externalUserName]);

  return null;
};
