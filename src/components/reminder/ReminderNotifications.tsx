
import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Reminder } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';
import { sendReminderPushNotification } from '@/utils/pushNotifications';
import { useAuth } from '@/contexts/AuthContext';

export const useReminderNotifications = (reminders: Reminder[]) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const audio = new Audio('/audio/notification.mp3');
    audio.volume = 0.5;
    audioRef.current = audio;

    // Stop audio after 1 second to ensure it doesn't play too long
    const stopAfterOneSecond = () => {
      setTimeout(() => {
        if (audio && !audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
      }, 1000);
    };
    
    audio.addEventListener('play', stopAfterOneSecond);

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
            
            // Send push notification
            if (user?.id) {
              sendReminderPushNotification(
                user.id,
                "Reminder Due Soon!",
                `${reminder.title} is due at ${format(new Date(reminder.remind_at), 'pp')}`
              ).catch(console.error);
            }
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
            
            // Send push notification
            if (user?.id) {
              sendReminderPushNotification(
                user.id,
                "⏰ Reminder Due Now!",
                `${reminder.title} is due now!`
              ).catch(console.error);
            }
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 30000);
    return () => {
      clearInterval(interval);
      audio.removeEventListener('play', stopAfterOneSecond);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [reminders, toast, user]);
};
