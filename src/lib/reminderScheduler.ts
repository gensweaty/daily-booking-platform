
import { supabase } from '@/lib/supabase';

export interface ReminderEntry {
  id: string;
  user_id: string;
  event_id?: string;
  task_id?: string;
  title: string;
  remind_at: string;
  delivered: boolean;
  delivered_at?: string;
  type: 'event' | 'task';
  created_at: string;
}

// Create reminder entries for events
export const createEventReminder = async (
  eventId: string,
  userId: string,
  title: string,
  remindAt: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('reminder_entries')
      .insert({
        user_id: userId,
        event_id: eventId,
        title,
        remind_at: remindAt,
        delivered: false,
        type: 'event'
      });

    if (error) {
      console.error('Error creating event reminder:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception creating event reminder:', error);
    return { success: false, error: 'Failed to create reminder' };
  }
};

// Create reminder entries for tasks
export const createTaskReminder = async (
  taskId: string,
  userId: string,
  title: string,
  remindAt: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('reminder_entries')
      .insert({
        user_id: userId,
        task_id: taskId,
        title,
        remind_at: remindAt,
        delivered: false,
        type: 'task'
      });

    if (error) {
      console.error('Error creating task reminder:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception creating task reminder:', error);
    return { success: false, error: 'Failed to create reminder' };
  }
};

// Update reminder as delivered
export const markReminderDelivered = async (
  reminderId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('reminder_entries')
      .update({
        delivered: true,
        delivered_at: new Date().toISOString()
      })
      .eq('id', reminderId);

    if (error) {
      console.error('Error marking reminder delivered:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception marking reminder delivered:', error);
    return { success: false, error: 'Failed to mark reminder delivered' };
  }
};
