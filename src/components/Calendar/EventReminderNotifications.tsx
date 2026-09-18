import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell } from "lucide-react";
import { platformNotificationManager } from "@/utils/platformNotificationManager";
import { sendAutoSms } from "@/lib/smsAutomation";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";

export const EventReminderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { businessProfile } = useBusinessProfile();
  const queryClient = useQueryClient();
  const [processedReminders, setProcessedReminders] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Load processed reminders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("processedEventReminders");
      if (stored) {
        const parsed = JSON.parse(stored);
        setProcessedReminders(new Set(parsed));
        console.log("📅 Loaded processed event reminders from storage:", parsed.length);
      }
    } catch (error) {
      console.error("❌ Error loading processed event reminders:", error);
    }
  }, []);

  // Save processed reminders to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("processedEventReminders", JSON.stringify(Array.from(processedReminders)));
    } catch (error) {
      console.error("❌ Error saving processed event reminders:", error);
    }
  }, [processedReminders]);

  // Fetch events with reminders
  // ISOLATION FIX: Exclude events created by sub-users - those belong to the sub-user only
  // Sub-user event reminders are handled by PublicBoardEventReminderNotifications
  const { data: events } = useQuery({
    queryKey: ['eventReminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        // IMPORTANT: Do NOT filter by email_reminder_enabled.
        // Cron/email sender may flip this to false before the reminder time,
        // which would otherwise prevent ALL in-app notifications.
        .lte('reminder_at', futureWindow.toISOString())
        .is('deleted_at', null)
        // CRITICAL: Exclude sub-user created events - their reminders are handled separately
        .or('created_by_type.is.null,created_by_type.neq.sub_user')
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching event reminders:', error);
        throw error;
      }
      
      // Filter out events with invalid or missing IDs
      const filtered = (data || []).filter(ev => !!ev.id && typeof ev.id === 'string');
      console.log('📅 Event reminders fetched (admin only):', data?.length || 0, 'filtered:', filtered.length);
      return filtered;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Show dashboard notification
  const showDashboardNotification = (eventTitle: string) => {
    console.log("📊 Showing dashboard notification for event:", eventTitle);
    toast({
      title: "📅 Event Reminder",
      description: `${t('events.eventReminder')}: ${eventTitle}`,
      duration: 8000,
      action: (
        <div className="flex items-center">
          <Bell className="h-4 w-4" />
        </div>
      ),
    });
  };

  // Send email reminder - FIXED: Use same pattern as task reminders
  const sendEmailReminder = async (event: any) => {
    try {
      console.log("📧 Sending email reminder for event:", event.title, "with ID:", event.id);
      
      // CRITICAL FIX: Use supabase.functions.invoke like task reminders, not raw fetch
      const { data, error } = await supabase.functions.invoke('send-event-reminder-email', {
        body: { eventId: event.id } // Same pattern as task reminders: no JSON.stringify needed
      });

      if (error) {
        console.error("❌ Error sending event email reminder:", error);
        toast({
          title: "Email Error",
          description: "Failed to send event email reminder",
          variant: "destructive",
        });
        return false;
      }

      console.log("✅ Event email reminder sent successfully:", data);
      
      toast({
        title: t("common.success"),
        description: t("events.reminderEmailSent"),
        duration: 3000,
      });
      
      return true;
    } catch (error) {
      console.error("❌ Failed to send event email reminder:", error);
      toast({
        title: "Email Error",
        description: "Failed to send event email reminder",
        variant: "destructive",
      });
      return false;
    }
  };

  // Process due reminders - with execution lock to prevent duplicates
  const processDueReminders = async (eventsToCheck: any[]) => {
    console.log('🔍 processDueReminders called with events:', eventsToCheck?.length || 0);
    console.log('🔍 isProcessing:', isProcessing);
    
    if (!eventsToCheck || eventsToCheck.length === 0) {
      console.log('❌ No events to check or empty array');
      return;
    }
    
    if (isProcessing) {
      console.log('⏸️ Already processing, skipping this run');
      return;
    }

    setIsProcessing(true);
    console.log('🚀 Starting to process event reminders...');
    
    try {
      const now = new Date();
      console.log('🕐 Current time:', now.toISOString());
      let notificationsTriggered = 0;
      
      for (const event of eventsToCheck) {
        console.log('🔍 Checking event:', {
          id: event?.id,
          title: event?.title,
          reminder_at: event?.reminder_at,
          email_reminder_enabled: event?.email_reminder_enabled
        });
        
        // ADD THIS GUARD: Validate event object before processing
        if (!event || typeof event !== "object" || !event.id || typeof event.id !== "string") {
          console.error('❌ Skipping invalid event object, missing or invalid "id":', event);
          continue;
        }
        
        if (!event.reminder_at) {
          console.log('⏭️ Skipping event without reminder_at:', event.id);
          continue;
        }
        
        const reminderTime = new Date(event.reminder_at);
        const reminderKey = `${event.id}-${event.reminder_at}`;
        
        console.log('⏰ Event reminder check:', {
          eventId: event.id,
          reminderTime: reminderTime.toISOString(),
          currentTime: now.toISOString(),
          alreadyProcessed: processedReminders.has(reminderKey)
        });
        
        // Check if reminder is due (within precise timing window)
        // Allow up to 5 seconds before (for processing) and 55 seconds after
        const timeDiff = now.getTime() - reminderTime.getTime();
        const isDue = timeDiff >= -5000 && timeDiff <= 55000;
        
        console.log('📊 Time analysis:', {
          timeDiff,
          isDue,
          reminderKey,
          processed: processedReminders.has(reminderKey)
        });
        
        if (isDue && !processedReminders.has(reminderKey)) {
          console.log('🔔 PROCESSING EVENT REMINDER for event:', event.title);
          console.log('⏰ Reminder time:', reminderTime.toLocaleString());
          console.log('🕐 Current time:', now.toLocaleString());
          console.log('⏱️ Time difference:', timeDiff, 'ms');
          console.log('📧 Event ID being processed:', event.id);
          
          // Mark as processed FIRST to prevent duplicate processing
          setProcessedReminders(prev => {
            const newSet = new Set([...prev, reminderKey]);
            console.log('✅ Marked as processed:', reminderKey);
            return newSet;
          });
          
          // Show dashboard notification
          showDashboardNotification(event.title || event.user_surname || 'Event');

          const eventTitle = event.title || event.user_surname || 'Event';

          // Emit to Dynamic Island - internal dashboard only
          window.dispatchEvent(new CustomEvent('dashboard-notification', {
            detail: {
              type: 'event_reminder',
              title: '📅 Event Reminder',
              message: `${t('events.eventReminder')}: ${eventTitle}`,
              actionData: { eventId: event.id },
              targetAudience: 'internal'
            }
          }));
          
          // Show system notification
          const result = await platformNotificationManager.createNotification({
            title: "📅 Event Reminder",
            body: `${t('events.eventReminder')}: ${eventTitle}`,
            icon: "/favicon.ico",
            tag: `event-reminder-${event.id}`,
            requireInteraction: true,
          });
          
          if (result.success) {
            console.log('🔔 System notification sent successfully', result.fallbackUsed ? '(fallback used)' : '');
          } else {
            console.error('❌ System notification failed:', result.error);
          }
          
          // Send email reminder if enabled
          if (event.email_reminder_enabled && !event.reminder_sent_at) {
            console.log('📧 About to call sendEmailReminder for event:', event.id);
            const emailSuccess = await sendEmailReminder(event);
            console.log('📧 Email reminder result:', emailSuccess ? 'SUCCESS' : 'FAILED');
          } else {
            console.log('📧 Email reminder skipped for event:', event.id, {
              email_reminder_enabled: event.email_reminder_enabled,
              reminder_sent_at: event.reminder_sent_at,
            });
          }
          
          console.log('📊 Dashboard notification: ✅ Sent');
          console.log('🔔 System notification:', result.success ? '✅ Sent' : '❌ Failed');
          console.log('📧 Email reminder:', event.email_reminder_enabled ? '✅ Enabled' : '❌ Disabled');
          
          notificationsTriggered++;
        } else if (isDue) {
          console.log('⏭️ Reminder due but already processed:', reminderKey);
        } else {
          console.log('⏭️ Reminder not due yet. Time diff:', timeDiff, 'ms');
        }
      }

      if (notificationsTriggered > 0) {
        console.log(`🎯 Total event notifications triggered: ${notificationsTriggered}`);
      } else {
        console.log('📋 No event notifications triggered this run');
      }
    } finally {
      setIsProcessing(false);
      console.log('✅ Finished processing event reminders');
    }
  };

  // Setup Supabase Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    console.log("🔗 Setting up Supabase realtime for event reminders");

    realtimeChannelRef.current = supabase
      .channel('event-reminders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('⚡ Realtime event change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['eventReminders', user.id] });
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
    if (!events || events.length === 0) return;

    console.log("⏰ Starting single event reminder checker");

    intervalRef.current = setInterval(() => {
      processDueReminders(events);
    }, 2000); // Check every 2 seconds to reduce load

    return () => {
      if (intervalRef.current) {
        console.log("🛑 Stopping event reminder checker");
        clearInterval(intervalRef.current);
      }
    };
  }, [events, processedReminders]);

  // Clean up old processed reminders every hour
  useEffect(() => {
    const cleanup = setInterval(() => {
      console.log('🧹 Cleaning up old processed event reminders');
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
        console.log('🧹 Event reminder cleanup complete. Before:', prev.size, 'After:', newSet.size);
        return newSet;
      });
    }, 60 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
