
import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { Reminder } from '@/lib/types';
import { platformNotificationManager } from '@/utils/platformNotificationManager';

export const ReminderNotificationManager = ({ reminders }: { reminders: Reminder[] }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [processedReminders, setProcessedReminders] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Load processed reminders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("processedReminders");
      if (stored) {
        const parsed = JSON.parse(stored);
        setProcessedReminders(new Set(parsed));
        console.log("📋 Loaded processed reminders from storage:", parsed.length);
      }
    } catch (error) {
      console.error("❌ Error loading processed reminders:", error);
    }
  }, []);

  // Save processed reminders to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("processedReminders", JSON.stringify(Array.from(processedReminders)));
    } catch (error) {
      console.error("❌ Error saving processed reminders:", error);
    }
  }, [processedReminders]);

  // Fetch reminders with real-time updates
  const { data: liveReminders } = useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes window
      
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .lte('remind_at', futureWindow.toISOString())
        .order('remind_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching live reminders:', error);
        throw error;
      }
      
      console.log('📋 Live reminders fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });

  // Setup Supabase Realtime subscription for immediate updates
  useEffect(() => {
    if (!user?.id) return;

    console.log("🔗 Setting up Supabase realtime for reminders");

    realtimeChannelRef.current = supabase
      .channel('reminders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('⚡ Realtime reminder change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['reminders', user.id] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      if (realtimeChannelRef.current) {
        console.log("🔌 Cleaning up realtime subscription");
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [user?.id, queryClient]);

  // Get localized notification messages
  const getNotificationMessages = (reminder: Reminder, type: 'soon' | 'now') => {
    const reminderTime = format(new Date(reminder.remind_at), 'pp');
    
    switch (language) {
      case 'ka':
        return {
          title: type === 'soon' ? "შეხსენება მალე დასრულდება!" : "⏰ შეხსენება ახლა დასრულდება!",
          body: type === 'soon' 
            ? `${reminder.title} დასრულდება ${reminderTime}-ზე`
            : `${reminder.title} ახლა დასრულდება!`
        };
      case 'es':
        return {
          title: type === 'soon' ? "¡Recordatorio próximo!" : "⏰ ¡Recordatorio ahora!",
          body: type === 'soon'
            ? `${reminder.title} vence a las ${reminderTime}`
            : `¡${reminder.title} vence ahora!`
        };
      default: // English
        return {
          title: type === 'soon' ? "Reminder Due Soon!" : "⏰ Reminder Due Now!",
          body: type === 'soon'
            ? `${reminder.title} is due at ${reminderTime}`
            : `${reminder.title} is due now!`
        };
    }
  };

  // Process due reminders
  const processDueReminders = async (remindersToCheck: Reminder[]) => {
    if (!remindersToCheck || remindersToCheck.length === 0) return;

    const now = new Date();
    let notificationsTriggered = 0;
    
    for (const reminder of remindersToCheck) {
      const reminderTime = new Date(reminder.remind_at);
      const reminderKey = `${reminder.id}-${reminder.remind_at}`;
      const timeDiff = reminderTime.getTime() - now.getTime();
      
      // Check if reminder is due in 5 minutes
      const fiveMinutes = 5 * 60 * 1000;
      const isDueSoon = timeDiff <= fiveMinutes && timeDiff > 60000;
      
      // Check if reminder is due now (within 1 minute)
      const isDueNow = Math.abs(timeDiff) <= 60000;
      
      if ((isDueSoon || isDueNow) && !processedReminders.has(reminderKey)) {
        const notificationType = isDueNow ? 'now' : 'soon';
        const messages = getNotificationMessages(reminder, notificationType);
        
        console.log(`🔔 TRIGGERING ${notificationType.toUpperCase()} NOTIFICATIONS for reminder:`, reminder.title);
        console.log('⏰ Reminder time:', reminderTime.toLocaleString());
        console.log('🕐 Current time:', now.toLocaleString());
        console.log('⏱️ Time difference:', timeDiff, 'ms');
        
        // Show dashboard notification with language support
        toast({
          title: messages.title,
          description: messages.body,
          variant: isDueNow ? "destructive" : "default",
          duration: isDueNow ? 10000 : 8000,
        });
        
        // Show platform-optimized system notification
        const result = await platformNotificationManager.createNotification({
          title: messages.title,
          body: messages.body,
          icon: "/favicon.ico",
          tag: `reminder-${notificationType}-${reminder.id}`,
          requireInteraction: isDueNow,
        });
        
        if (result.success) {
          console.log(`🔔 ${notificationType} system notification sent successfully`, result.fallbackUsed ? '(fallback used)' : '');
        } else {
          console.error(`❌ ${notificationType} system notification failed:`, result.error);
        }
        
        // Mark as processed
        setProcessedReminders(prev => {
          const newSet = new Set([...prev, reminderKey]);
          console.log('✅ Marked as processed:', reminderKey);
          return newSet;
        });
        
        notificationsTriggered++;
      }
    }

    if (notificationsTriggered > 0) {
      console.log(`🎯 Total notifications triggered: ${notificationsTriggered}`);
    }
  };

  // Use live reminders or fallback to passed reminders
  const activeReminders = liveReminders || reminders || [];

  // Set up interval to check reminders every second for precise timing
  useEffect(() => {
    if (!activeReminders || activeReminders.length === 0) return;

    console.log("⏰ Starting precision 1-second reminder checker");

    intervalRef.current = setInterval(() => {
      processDueReminders(activeReminders);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        console.log("🛑 Stopping precision checker");
        clearInterval(intervalRef.current);
      }
    };
  }, [activeReminders, processedReminders, language]);

  // Clean up old processed reminders every hour
  useEffect(() => {
    const cleanup = setInterval(() => {
      console.log('🧹 Cleaning up old processed reminders');
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      setProcessedReminders(prev => {
        const newSet = new Set<string>();
        prev.forEach(key => {
          const [, reminderTimeStr] = key.split('-');
          if (reminderTimeStr) {
            const reminderTime = new Date(reminderTimeStr);
            if (reminderTime > oneHourAgo) {
              newSet.add(key);
            }
          }
        });
        console.log('🧹 Cleanup complete. Before:', prev.size, 'After:', newSet.size);
        return newSet;
      });
    }, 60 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
