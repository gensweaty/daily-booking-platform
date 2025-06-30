
import { useEffect } from 'react';
import { format } from 'date-fns';
import { Reminder } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';
import { platformNotificationManager } from '@/utils/platformNotificationManager';

export const ReminderNotificationManager = ({ reminders }: { reminders: Reminder[] }) => {
  const { toast } = useToast();

  useEffect(() => {
    const checkReminders = async () => {
      if (!reminders || reminders.length === 0) return;

      reminders.forEach(async (reminder: Reminder) => {
        const dueTime = new Date(reminder.remind_at).getTime();
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;

        // 5 minutes before due
        if (dueTime - now <= fiveMinutes && dueTime > now) {
          const result = await platformNotificationManager.createNotification({
            title: "Reminder Due Soon!",
            body: `${reminder.title} is due at ${format(new Date(reminder.remind_at), 'pp')}`,
            icon: "/favicon.ico",
            tag: `reminder-soon-${reminder.id}`,
            requireInteraction: true,
          });

          if (result.success) {
            console.log("✅ 5-minute reminder notification sent", result.fallbackUsed ? "(fallback)" : "");
          } else {
            console.error("❌ 5-minute reminder notification failed:", result.error);
          }
          
          toast({
            title: "Reminder Due Soon!",
            description: `${reminder.title} is due at ${format(new Date(reminder.remind_at), 'pp')}`,
            variant: "default",
          });
        }

        // Due now
        if (Math.abs(dueTime - now) < 60000) {
          const result = await platformNotificationManager.createNotification({
            title: "⏰ Reminder Due Now!",
            body: `${reminder.title} is due now!`,
            icon: "/favicon.ico",
            tag: `reminder-now-${reminder.id}`,
            requireInteraction: true,
          });

          if (result.success) {
            console.log("✅ Due now reminder notification sent", result.fallbackUsed ? "(fallback)" : "");
          } else {
            console.error("❌ Due now reminder notification failed:", result.error);
          }
          
          toast({
            title: "⏰ Reminder Due Now!",
            description: `${reminder.title} is due now!`,
            variant: "destructive",
          });
        }
      });
    };

    const interval = setInterval(checkReminders, 30000);
    checkReminders(); // Run immediately
    
    return () => clearInterval(interval);
  }, [reminders, toast]);

  return null;
};
