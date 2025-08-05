
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
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
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

  // Save processed reminders to localStorage whenever they change
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
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Show dashboard notification
  const showDashboardNotification = (taskTitle: string) => {
    console.log("📊 Showing dashboard notification for:", taskTitle);
    toast({
      title: "📋 Task Reminder",
      description: `${t('tasks.taskReminder')}: ${taskTitle}`,
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
        return false;
      }

      console.log("✅ Email reminder sent successfully:", data);
      
      toast({
        title: t("common.success"),
        description: t("tasks.reminderEmailSent"),
        duration: 3000,
      });
      
      return true;
    } catch (error) {
      console.error("❌ Failed to send email reminder:", error);
      toast({
        title: "Email Error",
        description: "Failed to send email reminder",
        variant: "destructive",
      });
      return false;
    }
  };

  // Process due reminders - with execution lock to prevent duplicates
  const processDueReminders = async (tasksToCheck: any[]) => {
    if (!tasksToCheck || tasksToCheck.length === 0 || isProcessing) return;

    setIsProcessing(true);
    
    try {
      const now = new Date();
      let notificationsTriggered = 0;
      
      for (const task of tasksToCheck) {
        const reminderTime = new Date(task.reminder_at);
        const reminderKey = `${task.id}-${task.reminder_at}`;
        
        // Check if reminder is due (within 1 minute window)
        const timeDiff = now.getTime() - reminderTime.getTime();
        const isDue = timeDiff >= 0 && timeDiff <= 60000; // 0 to 60 seconds past due time
        
        if (isDue && !processedReminders.has(reminderKey)) {
          console.log('🔔 PROCESSING REMINDER for task:', task.title);
          console.log('⏰ Reminder time:', reminderTime.toLocaleString());
          console.log('🕐 Current time:', now.toLocaleString());
          console.log('⏱️ Time difference:', timeDiff, 'ms');
          console.log('📧 Email reminder enabled:', task.email_reminder_enabled);
          console.log('📋 Task status:', task.status);
          
          // Mark as processed FIRST to prevent duplicate processing
          setProcessedReminders(prev => {
            const newSet = new Set([...prev, reminderKey]);
            console.log('✅ Marked as processed:', reminderKey);
            return newSet;
          });
          
          // Show dashboard notification
          showDashboardNotification(task.title);
          
          // Show system notification
          const result = await platformNotificationManager.createNotification({
            title: "📋 Task Reminder",
            body: `${t('tasks.taskReminder')}: ${task.title}`,
            icon: "/favicon.ico",
            tag: `task-reminder-${task.id}`,
            requireInteraction: true,
          });
          
          if (result.success) {
            console.log('🔔 System notification sent successfully', result.fallbackUsed ? '(fallback used)' : '');
          } else {
            console.error('❌ System notification failed:', result.error);
          }
          
          // Send email reminder if enabled - CRITICAL: This should work regardless of status
          if (task.email_reminder_enabled) {
            console.log('📧 Attempting to send email reminder for task:', task.title, 'Status:', task.status);
            await sendEmailReminder(task);
          } else {
            console.log('📧 Email reminder disabled for task:', task.title);
          }
          
          console.log('📊 Dashboard notification: ✅ Sent');
          console.log('🔔 System notification:', result.success ? '✅ Sent' : '❌ Failed');
          console.log('📧 Email reminder:', task.email_reminder_enabled ? '✅ Enabled' : '❌ Disabled');
          
          notificationsTriggered++;
        }
      }

      if (notificationsTriggered > 0) {
        console.log(`🎯 Total notifications triggered: ${notificationsTriggered}`);
      }
    } finally {
      setIsProcessing(false);
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

  // Single interval for checking due reminders - prevents overlapping checks
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    console.log("⏰ Starting single reminder checker");

    intervalRef.current = setInterval(() => {
      processDueReminders(tasks);
    }, 2000); // Check every 2 seconds to reduce load

    return () => {
      if (intervalRef.current) {
        console.log("🛑 Stopping reminder checker");
        clearInterval(intervalRef.current);
      }
    };
  }, [tasks, processedReminders]);

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
