
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell } from "lucide-react";
import { platformNotificationManager } from "@/utils/platformNotificationManager";

export const TaskReminderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [processedReminders, setProcessedReminders] = useState<Set<string>>(new Set());
  const [processedEmailReminders, setProcessedEmailReminders] = useState<Set<string>>(new Set());
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
      
      const storedEmails = localStorage.getItem("processedTaskEmailReminders");
      if (storedEmails) {
        const parsedEmails = JSON.parse(storedEmails);
        setProcessedEmailReminders(new Set(parsedEmails));
        console.log("📧 Loaded processed email reminders from storage:", parsedEmails.length);
      }
    } catch (error) {
      console.error("❌ Error loading processed reminders:", error);
    }
  }, []);

  // Save processed reminders to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("processedTaskReminders", JSON.stringify(Array.from(processedReminders)));
    } catch (error) {
      console.error("❌ Error saving processed reminders:", error);
    }
  }, [processedReminders]);

  useEffect(() => {
    try {
      localStorage.setItem("processedTaskEmailReminders", JSON.stringify(Array.from(processedEmailReminders)));
    } catch (error) {
      console.error("❌ Error saving processed email reminders:", error);
    }
  }, [processedEmailReminders]);

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

  // Send email reminder
  const sendEmailReminder = async (task: any) => {
    const emailKey = `${task.id}-${task.reminder_at}-email`;
    
    if (processedEmailReminders.has(emailKey)) {
      console.log("📧 Email already sent for task:", task.title);
      return;
    }

    try {
      console.log("📧 Sending email reminder for task:", task.title);
      
      const { data, error } = await supabase.functions.invoke('send-task-reminder-email', {
        body: { taskId: task.id }
      });

      if (error) {
        console.error("❌ Error sending email reminder:", error);
        toast({
          title: "Email Error",
          description: "Failed to send email reminder",
          variant: "destructive",
        });
        return;
      }

      console.log("✅ Email reminder sent successfully:", data);
      
      // Mark as processed
      setProcessedEmailReminders(prev => new Set([...prev, emailKey]));
      
      toast({
        title: "📧 Email Sent",
        description: "Task reminder email sent successfully",
        duration: 3000,
      });
      
    } catch (error) {
      console.error("❌ Failed to send email reminder:", error);
      toast({
        title: "Email Error",
        description: "Failed to send email reminder",
        variant: "destructive",
      });
    }
  };

  // Process due reminders
  const processDueReminders = async (tasksToCheck: any[]) => {
    if (!tasksToCheck || tasksToCheck.length === 0) return;

    const now = new Date();
    let notificationsTriggered = 0;
    
    for (const task of tasksToCheck) {
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
        
        // Show dashboard notification
        showDashboardNotification(task.title);
        
        // Show platform-optimized system notification
        const result = await platformNotificationManager.createNotification({
          title: "📋 Task Reminder",
          body: `Reminder: ${task.title}`,
          icon: "/favicon.ico",
          tag: `task-reminder-${task.id}`,
          requireInteraction: true,
        });
        
        if (result.success) {
          console.log('🔔 System notification sent successfully', result.fallbackUsed ? '(fallback used)' : '');
        } else {
          console.error('❌ System notification failed:', result.error);
        }
        
        // Send email reminder if enabled
        if (task.email_reminder_enabled) {
          await sendEmailReminder(task);
        }
        
        console.log('📊 Dashboard notification:', '✅ Sent');
        console.log('🔔 System notification:', result.success ? '✅ Sent' : '❌ Failed');
        console.log('📧 Email reminder:', task.email_reminder_enabled ? '✅ Enabled' : '❌ Disabled');
        
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
    }, 1000);

    return () => {
      if (precisionIntervalRef.current) {
        console.log("🛑 Stopping precision checker");
        clearInterval(precisionIntervalRef.current);
      }
    };
  }, [tasks, processedReminders, processedEmailReminders]);

  // Backup interval system (failsafe)
  useEffect(() => {
    if (!user?.id) return;

    console.log("🛡️ Starting backup notification system");

    backupIntervalRef.current = setInterval(() => {
      console.log("🔄 Backup system: Force refreshing task reminders");
      queryClient.invalidateQueries({ queryKey: ['taskReminders', user.id] });
    }, 5000);

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

      setProcessedEmailReminders(prev => {
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
        return newSet;
      });
    }, 60 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
