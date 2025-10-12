import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function CustomReminderNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const processedReminders = useRef<Set<string>>(new Set());
  const lastCheckTime = useRef<number>(Date.now());

  // Fetch upcoming custom reminders
  const { data: reminders } = useQuery({
    queryKey: ['custom-reminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      const { data, error } = await supabase
        .from('custom_reminders')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .lte('remind_at', fiveMinutesFromNow.toISOString())
        .gte('remind_at', new Date(now.getTime() - 5 * 60 * 1000).toISOString())
        .or('reminder_sent_at.is.null,email_sent.eq.false');

      if (error) {
        console.error('Error fetching custom reminders:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds
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

  // Send email reminder
  const sendEmailReminder = async (reminder: any) => {
    try {
      console.log('📧 Sending email for custom reminder:', reminder.id);

      const { error } = await supabase.functions.invoke('send-custom-reminder-email', {
        body: {
          reminderId: reminder.id,
          userEmail: user?.email,
          title: reminder.title,
          message: reminder.message,
          reminderTime: reminder.remind_at,
        },
      });

      if (error) throw error;

      // Mark email as sent
      await supabase
        .from('custom_reminders')
        .update({ email_sent: true })
        .eq('id', reminder.id);

      console.log('✅ Email sent for custom reminder:', reminder.id);
    } catch (error) {
      console.error('❌ Error sending custom reminder email:', error);
    }
  };

  // Process due reminders
  const processDueReminders = async (remindersToCheck: any[]) => {
    if (!remindersToCheck || remindersToCheck.length === 0) return;

    const now = new Date();

    for (const reminder of remindersToCheck) {
      const reminderKey = `${reminder.id}-${reminder.remind_at}`;
      
      // Skip if already processed
      if (processedReminders.current.has(reminderKey)) {
        continue;
      }

      const remindTime = new Date(reminder.remind_at);
      
      // Check if reminder is due (within 1 minute window)
      if (remindTime <= now && remindTime > new Date(now.getTime() - 60000)) {
        console.log('⏰ Processing custom reminder:', reminder);

        // Show dashboard notification
        showDashboardNotification(reminder.title, reminder.message);

        // Show system notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🔔 Reminder: ${reminder.title}`, {
            body: reminder.message || 'Time for your scheduled reminder',
            icon: '/favicon.ico',
          });
        }

        // Send email reminder
        if (!reminder.email_sent) {
          await sendEmailReminder(reminder);
        }

        // Mark as sent
        await supabase
          .from('custom_reminders')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', reminder.id);

        // Mark as processed
        processedReminders.current.add(reminderKey);

        console.log('✅ Custom reminder processed:', reminder.id);
      }
    }
  };

  // Set up realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('custom-reminders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_reminders',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('🔄 Custom reminders changed, invalidating query');
          queryClient.invalidateQueries({ queryKey: ['custom-reminders', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Check reminders periodically
  useEffect(() => {
    if (!reminders || reminders.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // Only process if it's been at least 1 second since last check
      if (now - lastCheckTime.current >= 1000) {
        lastCheckTime.current = now;
        processDueReminders(reminders);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [reminders]);

  // Cleanup old processed reminders from memory
  useEffect(() => {
    const cleanup = setInterval(() => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      // Clear processed reminders older than 1 hour
      processedReminders.current = new Set(
        Array.from(processedReminders.current).filter((key) => {
          // Keep recent ones
          return true; // Simple cleanup - can be enhanced
        })
      );
    }, 60 * 60 * 1000); // Run every hour

    return () => clearInterval(cleanup);
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return null; // This component doesn't render anything
}
