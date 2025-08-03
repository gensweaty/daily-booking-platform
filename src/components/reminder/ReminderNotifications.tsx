
import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Reminder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface ReminderNotificationsProps {
  reminders: Reminder[];
}

export const ReminderNotifications = ({ reminders }: ReminderNotificationsProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    audioRef.current = new Audio('/audio/notification.mp3');
    audioRef.current.volume = 0.5; // Set volume to 50%

    if ('Notification' in window) {
      Notification.requestPermission();
    }

    const checkReminders = () => {
      reminders?.forEach((reminder: Reminder) => {
        const dueTime = new Date(reminder.remind_at).getTime();
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (dueTime - now <= fiveMinutes && dueTime > now) {
          if (Notification.permission === "granted") {
            audioRef.current?.play().catch(console.error);
            
            new Notification("Reminder Due Soon!", {
              body: `${reminder.title} is due at ${format(new Date(reminder.remind_at), 'pp')}`,
              icon: "/favicon.ico",
              badge: "/reminder-banner.jpg"
            });
            
            toast({
              title: "Reminder Due Soon!",
              description: `${reminder.title} is due at ${format(new Date(reminder.remind_at), 'pp')}`,
              variant: "default",
            });
          }
        }

        if (Math.abs(dueTime - now) < 60000) {
          if (Notification.permission === "granted") {
            audioRef.current?.play().catch(console.error);

            new Notification("Reminder Due Now!", {
              body: `${reminder.title} is due now!`,
              icon: "/favicon.ico",
              badge: "/reminder-banner.jpg"
            });
            
            toast({
              title: "⏰ Reminder Due Now!",
              description: `${reminder.title} is due now!`,
              variant: "destructive",
            });
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 30000);
    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [reminders, toast]);

  return null; // This component doesn't render anything visible
};

export const useReminderNotifications = (reminders: Reminder[]) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    audioRef.current = new Audio('/audio/notification.mp3');
    audioRef.current.volume = 0.5; // Set volume to 50%

    if ('Notification' in window) {
      Notification.requestPermission();
    }

    const checkReminders = () => {
      reminders?.forEach((reminder: Reminder) => {
        const dueTime = new Date(reminder.remind_at).getTime();
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (dueTime - now <= fiveMinutes && dueTime > now) {
          if (Notification.permission === "granted") {
            audioRef.current?.play().catch(console.error);
            
            new Notification("Reminder Due Soon!", {
              body: `${reminder.title} is due at ${format(new Date(reminder.remind_at), 'pp')}`,
              icon: "/favicon.ico",
              badge: "/reminder-banner.jpg"
            });
            
            toast({
              title: "Reminder Due Soon!",
              description: `${reminder.title} is due at ${format(new Date(reminder.remind_at), 'pp')}`,
              variant: "default",
            });
          }
        }

        if (Math.abs(dueTime - now) < 60000) {
          if (Notification.permission === "granted") {
            audioRef.current?.play().catch(console.error);

            new Notification("Reminder Due Now!", {
              body: `${reminder.title} is due now!`,
              icon: "/favicon.ico",
              badge: "/reminder-banner.jpg"
            });
            
            toast({
              title: "⏰ Reminder Due Now!",
              description: `${reminder.title} is due now!`,
              variant: "destructive",
            });
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 30000);
    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [reminders, toast]);
};
