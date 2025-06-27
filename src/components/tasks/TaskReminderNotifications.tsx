
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell } from "lucide-react";

export const TaskReminderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [processedReminders, setProcessedReminders] = useState<Set<string>>(new Set());
  const precisionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Load processed reminders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("processedTaskReminders");
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
      localStorage.setItem("processedTaskReminders", JSON.stringify(Array.from(processedReminders)));
    } catch (error) {
      console.error("❌ Error saving processed reminders:", error);
    }
  }, [processedReminders]);

  // Fetch tasks with reminders
  const { data: tasks } = useQuery({
    queryKey: ['taskReminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        .lte('reminder_at', futureWindow.toISOString())
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching task reminders:', error);
        throw error;
      }
      
      console.log('📋 Task reminders fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Backup polling every 30 seconds
  });

  // Enhanced browser notification function
  const showBrowserNotification = (taskTitle: string) => {
    console.log("🔔 Attempting browser notification for:", taskTitle);
    
    if (!("Notification" in window)) {
      console.warn("❌ Browser doesn't support notifications");
      return false;
    }

    if (Notification.permission !== "granted") {
      console.warn("⛔ Browser notifications not permitted");
      return false;
    }

    try {
      const notification = new Notification("📋 Task Reminder", {
        body: `Reminder: ${taskTitle}`,
        icon: "/favicon.ico",
        tag: `task-reminder-${taskTitle}`,
        requireInteraction: true,
        silent: false,
      });

      console.log("✅ Browser notification created successfully");

      notification.onclick = () => {
        console.log("🖱️ Notification clicked");
        window.focus();
        notification.close();
      };

      notification.onshow = () => {
        console.log("👁️ Notification shown");
        playNotificationSound();
      };

      notification.onerror = (error) => {
        console.error("❌ Notification error:", error);
      };

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

      return true;
    } catch (error) {
      console.error("❌ Error creating browser notification:", error);
      return false;
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio("/audio/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch((error) => {
        console.log("🔇 Could not play notification sound:", error);
      });
    } catch (error) {
      console.log("🔇 Notification sound not available:", error);
    }
  };

  // Show dashboard notification
  const showDashboardNotification = (taskTitle: string) => {
    console.log("📊 Showing dashboard notification for:", taskTitle);
    toast({
      title: "📋 Task Reminder",
      description: `Reminder: ${taskTitle}`,
      duration: 8000,
      action: (
        <div className="flex items-center">
          <Bell className="h-4 w-4" />
        </div>
      ),
    });
  };

  // Process due reminders
  const processDueReminders = (tasksToCheck: any[]) => {
    if (!tasksToCheck || tasksToCheck.length === 0) return;

    const now = new Date();
    let notificationsTriggered = 0;
    
    tasksToCheck.forEach((task) => {
      const reminderTime = new Date(task.reminder_at);
      const reminderKey = `${task.id}-${task.reminder_at}`;
      
      // Check if reminder is due (within 1 minute window)
      const timeDiff = now.getTime() - reminderTime.getTime();
      const isDue = timeDiff >= 0 && timeDiff <= 60000; // 0 to 60 seconds past due time
      
      if (isDue && !processedReminders.has(reminderKey)) {
        console.log('🔔 TRIGGERING NOTIFICATIONS for task:', task.title);
        console.log('⏰ Reminder time:', reminderTime.toLocaleString());
        console.log('🕐 Current time:', now.toLocaleString());
        console.log('⏱️ Time difference:', timeDiff, 'ms');
        
        // Show both notifications
        showDashboardNotification(task.title);
        const browserSuccess = showBrowserNotification(task.title);
        
        console.log('📊 Dashboard notification:', '✅ Sent');
        console.log('🔔 Browser notification:', browserSuccess ? '✅ Sent' : '❌ Failed');
        
        // Mark as processed
        setProcessedReminders(prev => {
          const newSet = new Set([...prev, reminderKey]);
          console.log('✅ Marked as processed:', reminderKey);
          return newSet;
        });
        
        notificationsTriggered++;
      }
    });

    if (notificationsTriggered > 0) {
      console.log(`🎯 Total notifications triggered: ${notificationsTriggered}`);
    }
  };

  // Setup Supabase Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    console.log("🔗 Setting up Supabase realtime for task reminders");

    realtimeChannelRef.current = supabase
      .channel('task-reminders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('⚡ Realtime task change detected:', payload.eventType);
          // Invalidate queries to fetch fresh data
          queryClient.invalidateQueries({ queryKey: ['taskReminders', user.id] });
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

  // Precision interval for 1-second checking
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    console.log("⏰ Starting precision 1-second reminder checker");

    precisionIntervalRef.current = setInterval(() => {
      processDueReminders(tasks);
    }, 1000); // Check every second for precision

    return () => {
      if (precisionIntervalRef.current) {
        console.log("🛑 Stopping precision checker");
        clearInterval(precisionIntervalRef.current);
      }
    };
  }, [tasks, processedReminders]);

  // Backup interval system (failsafe)
  useEffect(() => {
    if (!user?.id) return;

    console.log("🛡️ Starting backup notification system");

    backupIntervalRef.current = setInterval(() => {
      console.log("🔄 Backup system: Force refreshing task reminders");
      queryClient.invalidateQueries({ queryKey: ['taskReminders', user.id] });
    }, 5000); // Every 5 seconds as backup

    return () => {
      if (backupIntervalRef.current) {
        console.log("🛑 Stopping backup system");
        clearInterval(backupIntervalRef.current);
      }
    };
  }, [user?.id, queryClient]);

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
    }, 60 * 60 * 1000); // Clean up every hour

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
