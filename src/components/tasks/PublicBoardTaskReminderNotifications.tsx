import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePublicBoardAuth } from '@/contexts/PublicBoardAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { platformNotificationManager } from '@/utils/platformNotificationManager';

interface PublicBoardTaskReminderNotificationsProps {
  boardOwnerId: string;
  externalUserName: string;
}

/**
 * Sub-user task reminder notification listener for public boards.
 * Polls for task reminders created by the current sub-user and dispatches notifications
 * with targetAudience='public' to ensure they appear ONLY in the sub-user's Dynamic Island.
 */
export function PublicBoardTaskReminderNotifications({ 
  boardOwnerId, 
  externalUserName 
}: PublicBoardTaskReminderNotificationsProps) {
  const { user: publicBoardUser } = usePublicBoardAuth();
  const { t } = useLanguage();
  const processedReminders = useRef<Set<string>>(new Set());

  // Get current sub-user's ID and email
  const subUserId = publicBoardUser?.id;
  const subUserEmail = publicBoardUser?.email;

  // Load processed reminders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`processedPublicTaskReminders_${subUserEmail}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        processedReminders.current = new Set(parsed);
        console.log("📋 [PublicTaskReminders] Loaded processed reminders:", parsed.length);
      }
    } catch (error) {
      console.error("❌ [PublicTaskReminders] Error loading processed reminders:", error);
    }
  }, [subUserEmail]);

  // Save processed reminders to localStorage whenever they change
  const saveProcessedReminders = () => {
    try {
      localStorage.setItem(
        `processedPublicTaskReminders_${subUserEmail}`, 
        JSON.stringify(Array.from(processedReminders.current))
      );
    } catch (error) {
      console.error("❌ [PublicTaskReminders] Error saving processed reminders:", error);
    }
  };

  // Fetch tasks with reminders created by this sub-user
  const { data: tasks } = useQuery({
    queryKey: ['publicTaskReminders', boardOwnerId, externalUserName],
    queryFn: async () => {
      if (!boardOwnerId || !externalUserName) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window
      
      console.log('🔔 [PublicTaskReminders] Querying tasks for sub-user:', externalUserName);
      
      // Query tasks created by THIS sub-user with reminders
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', boardOwnerId)
        .eq('created_by_type', 'sub_user')
        .eq('created_by_name', externalUserName)
        .not('reminder_at', 'is', null)
        .is('reminder_sent_at', null) // Only fetch unsent reminders
        .lte('reminder_at', futureWindow.toISOString())
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('❌ [PublicTaskReminders] Error fetching sub-user task reminders:', error);
        throw error;
      }
      
      console.log('🔔 [PublicTaskReminders] Sub-user task reminders fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!boardOwnerId && !!externalUserName,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Show toast notification
  const showToastNotification = (taskTitle: string) => {
    toast.info(`📋 Task Reminder`, {
      description: `${t('tasks.taskReminder')}: ${taskTitle}`,
      duration: 10000,
    });
  };

  // Process due reminders
  const processDueReminders = async (tasksToCheck: any[]) => {
    if (!tasksToCheck || tasksToCheck.length === 0) return;
    
    const now = new Date();
    let notificationsTriggered = 0;
    
    for (const task of tasksToCheck) {
      const reminderTime = new Date(task.reminder_at);
      const reminderKey = `${task.id}-${task.reminder_at}`;
      
      // Check if reminder is due (within time window for processing)
      const timeDiff = reminderTime.getTime() - now.getTime();
      const isDue = timeDiff >= -5000 && timeDiff <= 60000; // 5 seconds before to 60 seconds after
      
      if (isDue && !processedReminders.current.has(reminderKey)) {
        console.log('🔔 [PublicTaskReminders] PROCESSING REMINDER for task:', task.title);
        
        // Mark as processed
        processedReminders.current.add(reminderKey);
        saveProcessedReminders();

        // Update database (mark as sent)
        try {
          await supabase
            .from('tasks')
            .update({ reminder_sent_at: now.toISOString() })
            .eq('id', task.id);
        } catch (dbError) {
          console.error('❌ [PublicTaskReminders] Database update exception:', dbError);
        }
        
        // Show toast notification
        showToastNotification(task.title);

        // CRITICAL: Emit to Dynamic Island with targetAudience='public'
        console.log('📤 [PublicTaskReminders] Dispatching notification for sub-user:', subUserEmail);
        window.dispatchEvent(new CustomEvent('dashboard-notification', {
          detail: {
            type: 'task_reminder',
            title: '📋 Task Reminder',
            message: `${t('tasks.taskReminder')}: ${task.title}`,
            actionData: { taskId: task.id },
            targetAudience: 'public', // CRITICAL: Only show on public board
            recipientSubUserId: subUserId,
            recipientSubUserEmail: subUserEmail,
          }
        }));

        // Play notification sound
        import('@/utils/audioManager')
          .then(({ playNotificationSound }) => playNotificationSound())
          .catch(() => {});
        
        // Show system notification
        const result = await platformNotificationManager.createNotification({
          title: "📋 Task Reminder",
          body: `${t('tasks.taskReminder')}: ${task.title}`,
          icon: "/favicon.ico",
          tag: `task-reminder-${task.id}`,
          requireInteraction: true,
        });
        
        if (result.success) {
          console.log('🔔 [PublicTaskReminders] System notification sent successfully');
        }
        
        notificationsTriggered++;
      }
    }

    if (notificationsTriggered > 0) {
      console.log(`🎯 [PublicTaskReminders] Total sub-user task notifications triggered: ${notificationsTriggered}`);
    }
  };

  // Single interval for checking due reminders
  useEffect(() => {
    if (!tasks || tasks.length === 0 || !externalUserName) return;

    console.log("⏰ [PublicTaskReminders] Starting sub-user task reminder checker for:", externalUserName);

    const interval = setInterval(() => {
      processDueReminders(tasks);
    }, 2000); // Check every 2 seconds

    return () => {
      console.log("🛑 [PublicTaskReminders] Stopping sub-user task reminder checker");
      clearInterval(interval);
    };
  }, [tasks, externalUserName, subUserEmail]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Cleanup old processed reminders every hour
  useEffect(() => {
    const cleanup = setInterval(() => {
      console.log('🧹 [PublicTaskReminders] Cleaning up old processed reminders');
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const newSet = new Set<string>();
      processedReminders.current.forEach(key => {
        const parts = key.split('-');
        const reminderTimeStr = parts.slice(1).join('-');
        if (reminderTimeStr) {
          const reminderTime = new Date(reminderTimeStr);
          if (reminderTime > oneHourAgo) {
            newSet.add(key);
          }
        }
      });
      
      console.log('🧹 [PublicTaskReminders] Cleanup complete. Before:', processedReminders.current.size, 'After:', newSet.size);
      processedReminders.current = newSet;
      saveProcessedReminders();
    }, 60 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component doesn't render anything
}
