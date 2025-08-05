
import { useEffect } from 'react';
import { useReminderSync } from '@/hooks/useReminderSync';

export const ReminderManager = () => {
  // Sync reminders between events/tasks and reminder_entries table
  useReminderSync();

  return null; // This component only handles background sync
};
