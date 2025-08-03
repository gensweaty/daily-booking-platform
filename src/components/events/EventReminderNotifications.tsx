
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export const EventReminderNotifications = ({ businessId }: { businessId?: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [processedEvents, setProcessedEvents] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Load processed events from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("processedEventReminders");
      if (stored) {
        const parsed = JSON.parse(stored);
        setProcessedEvents(new Set(parsed));
        console.log("📅 Loaded processed event reminders from storage:", parsed.length);
      }
    } catch (error) {
      console.error("❌ Error loading processed event reminders:", error);
    }
  }, []);

  // Save processed events to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("processedEventReminders", JSON.stringify(Array.from(processedEvents)));
    } catch (error) {
      console.error("❌ Error saving processed event reminders:", error);
    }
  }, [processedEvents]);

  // Fetch events with reminders due
  const { data: eventsDue = [] } = useQuery({
    queryKey: ['eventReminders', businessId || user?.id],
    queryFn: async () => {
      if (!businessId && !user?.id) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window
      
      let query = supabase
        .from('events')
        .select(`
          id, title, start_date, end_date, user_surname, user_number,
          social_network_link, event_notes, payment_status, payment_amount,
          reminder_at, email_reminder_enabled, reminder_sent_at, language,
          user_id
        `)
        .eq('email_reminder_enabled', true)
        .not('reminder_at', 'is', null)
        .lte('reminder_at', futureWindow.toISOString())
        .is('deleted_at', null)
        .order('reminder_at', { ascending: true });

      // Filter by business context or user
      if (businessId) {
        // For business context, we need to get the business owner's user_id first
        const { data: business } = await supabase
          .from('business_profiles')
          .select('user_id')
          .eq('id', businessId)
          .single();
        
        if (business) {
          query = query.eq('user_id', business.user_id);
        }
      } else if (user?.id) {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Error fetching event reminders:', error);
        throw error;
      }
      
      console.log('📅 Event reminders fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!(businessId || user?.id),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Show dashboard notification
  const showDashboardNotification = (eventTitle: string) => {
    console.log("📊 Showing dashboard notification for event:", eventTitle);
    toast({
      title: "📅 Event Reminder Sent",
      description: `Reminder sent for: ${eventTitle}`,
      duration: 5000,
    });
  };

  // Send event reminder email
  const sendEventReminderEmail = async (event: any) => {
    try {
      console.log("📧 Sending event reminder email for:", event.title);
      
      const { data, error } = await supabase.functions.invoke('send-event-reminder-email', {
        body: { eventId: event.id }
      });

      if (error) {
        console.error("❌ Error sending event reminder email:", error);
        toast({
          title: "Email Error",
          description: "Failed to send event reminder email",
          variant: "destructive",
        });
        return false;
      }

      console.log("✅ Event reminder email sent successfully:", data);
      
      toast({
        title: t("common.success"),
        description: "Event reminder email sent successfully",
        duration: 3000,
      });
      
      return true;
    } catch (error) {
      console.error("❌ Failed to send event reminder email:", error);
      toast({
        title: "Email Error",
        description: "Failed to send event reminder email",
        variant: "destructive",
      });
      return false;
    }
  };

  // Process due event reminders
  const processDueReminders = async (eventsToCheck: any[]) => {
    if (!eventsToCheck || eventsToCheck.length === 0 || isProcessing) return;

    setIsProcessing(true);
    
    try {
      const now = new Date();
      let remindersTriggered = 0;
      
      for (const event of eventsToCheck) {
        const reminderTime = new Date(event.reminder_at);
        const reminderKey = `${event.id}-${event.reminder_at}`;
        
        // Check if reminder is due (within 1 minute window)
        const timeDiff = now.getTime() - reminderTime.getTime();
        const isDue = timeDiff >= 0 && timeDiff <= 60000; // 0 to 60 seconds past due time
        
        if (isDue && !processedEvents.has(reminderKey)) {
          console.log('🔔 PROCESSING EVENT REMINDER for:', event.title);
          console.log('⏰ Reminder time:', reminderTime.toLocaleString());
          console.log('🕐 Current time:', now.toLocaleString());
          console.log('⏱️ Time difference:', timeDiff, 'ms');
          
          // Mark as processed FIRST to prevent duplicate processing
          setProcessedEvents(prev => {
            const newSet = new Set([...prev, reminderKey]);
            console.log('✅ Marked event reminder as processed:', reminderKey);
            return newSet;
          });
          
          // Show dashboard notification
          showDashboardNotification(event.title || event.user_surname || 'Event');
          
          // Send event reminder email
          await sendEventReminderEmail(event);
          
          console.log('📊 Dashboard notification: ✅ Sent');
          console.log('📧 Event reminder email: ✅ Sent');
          
          remindersTriggered++;
        }
      }

      if (remindersTriggered > 0) {
        console.log(`🎯 Total event reminders triggered: ${remindersTriggered}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Setup Supabase Realtime subscription
  useEffect(() => {
    const contextId = businessId || user?.id;
    if (!contextId) return;

    console.log("🔗 Setting up Supabase realtime for event reminders");

    realtimeChannelRef.current = supabase
      .channel('event-reminders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: businessId ? `user_id=eq.${contextId}` : `user_id=eq.${contextId}`
        },
        (payload) => {
          console.log('⚡ Realtime event change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['eventReminders', contextId] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Event reminders realtime subscription status:', status);
      });

    return () => {
      if (realtimeChannelRef.current) {
        console.log("🔌 Cleaning up event reminders realtime subscription");
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [businessId, user?.id, queryClient]);

  // Single interval for checking due reminders
  useEffect(() => {
    if (!eventsDue || eventsDue.length === 0) return;

    console.log("⏰ Starting event reminder checker");

    intervalRef.current = setInterval(() => {
      processDueReminders(eventsDue);
    }, 2000); // Check every 2 seconds

    return () => {
      if (intervalRef.current) {
        console.log("🛑 Stopping event reminder checker");
        clearInterval(intervalRef.current);
      }
    };
  }, [eventsDue, processedEvents]);

  // Clean up old processed reminders every hour
  useEffect(() => {
    const cleanup = setInterval(() => {
      console.log('🧹 Cleaning up old processed event reminders');
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      setProcessedEvents(prev => {
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
        console.log('🧹 Event reminders cleanup complete. Before:', prev.size, 'After:', newSet.size);
        return newSet;
      });
    }, 60 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
