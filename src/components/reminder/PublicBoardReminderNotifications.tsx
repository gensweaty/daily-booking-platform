import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePublicBoardAuth } from '@/contexts/PublicBoardAuthContext';

interface PublicBoardReminderNotificationsProps {
  boardOwnerId: string;
}

/**
 * Sub-user reminder notification listener for public boards.
 * Polls for reminders created by the current sub-user and dispatches notifications
 * with targetAudience='public' to ensure they appear ONLY in the sub-user's Dynamic Island.
 */
export function PublicBoardReminderNotifications({ boardOwnerId }: PublicBoardReminderNotificationsProps) {
  const { user: publicBoardUser } = usePublicBoardAuth();
  const queryClient = useQueryClient();
  const processedReminders = useRef<Set<string>>(new Set());

  // Get current sub-user's ID
  const subUserId = publicBoardUser?.id;
  const subUserEmail = publicBoardUser?.email;

  // Fetch custom reminders for this specific sub-user
  const { data: reminders } = useQuery({
    queryKey: ['public-board-reminders', boardOwnerId, subUserId],
    queryFn: async () => {
      if (!boardOwnerId || !subUserId) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window
      
      // Query reminders created by THIS sub-user
      const { data, error } = await supabase
        .from('custom_reminders')
        .select('*')
        .eq('user_id', boardOwnerId)
        .eq('created_by_type', 'sub_user')
        .eq('created_by_sub_user_id', subUserId)
        .lte('remind_at', futureWindow.toISOString())
        .is('deleted_at', null)
        .order('remind_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching sub-user reminders:', error);
        throw error;
      }
      
      console.log('🔔 Sub-user reminders fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!boardOwnerId && !!subUserId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Show dashboard notification
  const showDashboardNotification = (title: string, message?: string) => {
    toast.info(`🔔 Reminder: ${title}`, {
      description: message,
      duration: 10000,
      action: {
        label: 'Dismiss',
        onClick: () => {},
      },
    });
  };

  // Process due reminders
  const processDueReminders = async (remindersToCheck: any[]) => {
    if (!remindersToCheck || remindersToCheck.length === 0) return;
    
    const now = new Date();
    let notificationsTriggered = 0;
    
    for (const reminder of remindersToCheck) {
      const reminderTime = new Date(reminder.remind_at);
      const reminderKey = `${reminder.id}-${reminder.remind_at}`;
      
      // Check if reminder is due (within 1 minute window)
      const timeDiff = now.getTime() - reminderTime.getTime();
      const isDue = timeDiff >= 0 && timeDiff <= 60000;
      
      if (isDue && !processedReminders.current.has(reminderKey)) {
        console.log('🔔 PROCESSING SUB-USER REMINDER:', reminder.title);
        
        // Mark as processed
        processedReminders.current.add(reminderKey);

        // Update database (mark as sent)
        try {
          await supabase
            .from('custom_reminders')
            .update({ reminder_sent_at: now.toISOString() })
            .eq('id', reminder.id);
        } catch (dbError) {
          console.error('❌ Database update exception:', dbError);
        }
        
        // Show toast notification
        showDashboardNotification(reminder.title, reminder.message);

        // CRITICAL: Emit to Dynamic Island with targetAudience='public' and recipientSubUserId
        // This ensures ONLY this sub-user receives the notification
        window.dispatchEvent(new CustomEvent('dashboard-notification', {
          detail: {
            type: 'custom_reminder',
            title: `🔔 Reminder: ${reminder.title}`,
            message: reminder.message || 'Time for your scheduled reminder',
            actionData: { reminderId: reminder.id },
            targetAudience: 'public', // CRITICAL: Only show on public board
            recipientSubUserId: subUserId, // CRITICAL: Only for this specific sub-user
            recipientSubUserEmail: subUserEmail, // Fallback identification
          }
        }));
        
        // Show system notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🔔 Reminder: ${reminder.title}`, {
            body: reminder.message || 'Time for your scheduled reminder',
            icon: '/favicon.ico',
          });
        }
        
        notificationsTriggered++;
      }
    }

    if (notificationsTriggered > 0) {
      console.log(`🎯 Total sub-user notifications triggered: ${notificationsTriggered}`);
    }
  };

  // Single interval for checking due reminders
  useEffect(() => {
    if (!reminders || reminders.length === 0) return;

    console.log("⏰ Starting sub-user reminder checker");

    const interval = setInterval(() => {
      processDueReminders(reminders);
    }, 2000); // Check every 2 seconds

    return () => {
      console.log("🛑 Stopping sub-user reminder checker");
      clearInterval(interval);
    };
  }, [reminders]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return null; // This component doesn't render anything
}
