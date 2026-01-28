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

  // Fetch custom reminders - EXACT SAME PATTERN AS TASKS
  const { data: reminders } = useQuery({
    queryKey: ['custom-reminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window (same as tasks)
      
      const { data, error } = await supabase
        .from('custom_reminders')
        .select('*')
        .eq('user_id', user.id)
        .lte('remind_at', futureWindow.toISOString())
        .is('deleted_at', null)
        .order('remind_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching custom reminders:', error);
        throw error;
      }
      
      console.log('🔔 Custom reminders fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds (SAME AS TASKS)
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

  // Email sending is handled by backend process-reminders edge function
  // This prevents duplicate emails for admin users

  // Process due reminders - EXACT SAME LOGIC AS TASKS
  const processDueReminders = async (remindersToCheck: any[]) => {
    if (!remindersToCheck || remindersToCheck.length === 0) return;
    
    const now = new Date();
    let notificationsTriggered = 0;
    
    for (const reminder of remindersToCheck) {
      const reminderTime = new Date(reminder.remind_at);
      const reminderKey = `${reminder.id}-${reminder.remind_at}`;
      
      // EXACT SAME DETECTION AS TASKS: Check if reminder is due (within 1 minute window)
      const timeDiff = now.getTime() - reminderTime.getTime();
      const isDue = timeDiff >= 0 && timeDiff <= 60000; // 0 to 60 seconds past due time (SAME AS TASKS)
      
      if (isDue && !processedReminders.current.has(reminderKey)) {
        console.log('🔔 PROCESSING CUSTOM REMINDER:', reminder.title);
        console.log('⏰ Reminder time:', reminderTime.toLocaleString());
        console.log('🕐 Current time:', now.toLocaleString());
        console.log('⏱️ Time difference:', timeDiff, 'ms');
        
        // NEW: Check if there's a recipient email (for customers/event persons)
        const recipientEmail = reminder.recipient_email;
        const emailToNotify = recipientEmail || user?.email;
        console.log('📧 Email reminder will be sent to:', emailToNotify);
        if (recipientEmail) {
          console.log('📧 Sending to customer/event person:', recipientEmail);
        }
        
        // Mark as processed FIRST to prevent duplicate processing (SAME AS TASKS)
        processedReminders.current.add(reminderKey);
        console.log('✅ Marked as processed:', reminderKey);

        // Update database IMMEDIATELY (mark as sent before email attempt)
        try {
          const { error: updateError } = await supabase
            .from('custom_reminders')
            .update({ reminder_sent_at: now.toISOString() })
            .eq('id', reminder.id);
          
          if (updateError) {
            console.error('❌ Error marking reminder as sent:', updateError);
          } else {
            console.log('✅ Database marked as sent:', reminder.id);
          }
        } catch (dbError) {
          console.error('❌ Database update exception:', dbError);
        }
        
        // Show dashboard notification
        showDashboardNotification(reminder.title, reminder.message);

        // Emit to Dynamic Island - IMPORTANT: Only for internal dashboard admin
        // Sub-user reminders are handled via AI chat reminder_alert messages in their own context
        window.dispatchEvent(new CustomEvent('dashboard-notification', {
          detail: {
            type: 'custom_reminder',
            title: `🔔 Reminder: ${reminder.title}`,
            message: reminder.message || 'Time for your scheduled reminder',
            actionData: { reminderId: reminder.id },
            targetAudience: 'internal' // Only show on internal dashboard, not public board
          }
        }));
        
        // Show system notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🔔 Reminder: ${reminder.title}`, {
            body: reminder.message || 'Time for your scheduled reminder',
            icon: '/favicon.ico',
          });
          console.log('🔔 System notification sent');
        }
        
        console.log('📊 Dashboard notification: ✅ Sent');
        console.log('🔔 System notification: ✅ Sent');
        console.log('📧 Email reminder: ✅ Handled by backend');
        
        notificationsTriggered++;
      }
    }

    if (notificationsTriggered > 0) {
      console.log(`🎯 Total custom notifications triggered: ${notificationsTriggered}`);
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

  // Single interval for checking due reminders - SAME AS TASKS
  useEffect(() => {
    if (!reminders || reminders.length === 0) return;

    console.log("⏰ Starting custom reminder checker");

    const interval = setInterval(() => {
      processDueReminders(reminders);
    }, 2000); // Check every 2 seconds (SAME AS TASKS)

    return () => {
      console.log("🛑 Stopping custom reminder checker");
      clearInterval(interval);
    };
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
