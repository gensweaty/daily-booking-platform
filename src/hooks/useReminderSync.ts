
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createEventReminder, createTaskReminder } from '@/lib/reminderScheduler';
import { supabase } from '@/lib/supabase';

export const useReminderSync = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const syncReminders = async () => {
      try {
        console.log('🔄 Syncing reminders for user:', user.id);

        // Find events with reminders that don't have reminder entries yet
        const { data: eventsWithReminders, error: eventsError } = await supabase
          .from('events')
          .select('id, title, reminder_at, email_reminder_enabled')
          .eq('user_id', user.id)
          .eq('email_reminder_enabled', true)
          .not('reminder_at', 'is', null)
          .is('deleted_at', null);

        if (!eventsError && eventsWithReminders) {
          for (const event of eventsWithReminders) {
            // Check if reminder entry already exists
            const { data: existing } = await supabase
              .from('reminder_entries')
              .select('id')
              .eq('event_id', event.id)
              .eq('type', 'event')
              .single();

            if (!existing) {
              console.log('📅 Creating reminder entry for event:', event.title);
              await createEventReminder(
                event.id,
                user.id,
                event.title,
                event.reminder_at
              );
            }
          }
        }

        // Find tasks with reminders that don't have reminder entries yet
        const { data: tasksWithReminders, error: tasksError } = await supabase
          .from('tasks')
          .select('id, title, reminder_at, email_reminder_enabled')
          .eq('user_id', user.id)
          .eq('email_reminder_enabled', true)
          .not('reminder_at', 'is', null)
          .eq('archived', false);

        if (!tasksError && tasksWithReminders) {
          for (const task of tasksWithReminders) {
            // Check if reminder entry already exists
            const { data: existing } = await supabase
              .from('reminder_entries')
              .select('id')
              .eq('task_id', task.id)
              .eq('type', 'task')
              .single();

            if (!existing) {
              console.log('📋 Creating reminder entry for task:', task.title);
              await createTaskReminder(
                task.id,
                user.id,
                task.title,
                task.reminder_at
              );
            }
          }
        }

        console.log('✅ Reminder sync completed');
      } catch (error) {
        console.error('❌ Error syncing reminders:', error);
      }
    };

    // Sync on mount and then periodically
    syncReminders();
    const interval = setInterval(syncReminders, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [user?.id]);
};
