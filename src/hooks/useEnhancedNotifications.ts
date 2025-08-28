import { useCallback, useRef } from 'react';
import { platformNotificationManager } from '@/utils/platformNotificationManager';

export interface NotificationData {
  title: string;
  body: string;
  channelId: string;
  senderId: string;
  senderName: string;
}

export const useEnhancedNotifications = () => {
  const lastNotificationTime = useRef<number>(0);
  const pendingNotifications = useRef<Map<string, NotificationData[]>>(new Map());

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('🚫 Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      console.log('✅ Notification permission already granted');
      return true;
    }

    if (Notification.permission !== 'denied') {
      console.log('🔔 Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('🔔 Notification permission result:', permission);
      return permission === 'granted';
    }

    console.log('❌ Notification permission denied');
    return false;
  }, []);

  const showNotification = useCallback(async (data: NotificationData) => {
    const now = Date.now();
    const timeSinceLastNotification = now - lastNotificationTime.current;

    // Batch notifications if they come too quickly (within 2 seconds)
    if (timeSinceLastNotification < 2000) {
      const existingBatch = pendingNotifications.current.get(data.senderId) || [];
      existingBatch.push(data);
      pendingNotifications.current.set(data.senderId, existingBatch);
      
      // Show batched notification after delay
      setTimeout(() => {
        const batch = pendingNotifications.current.get(data.senderId);
        if (batch && batch.length > 0) {
          const batchData = batch.length === 1 
            ? batch[0]
            : {
                ...batch[0],
                title: `${batch[0].senderName} (${batch.length} messages)`,
                body: `Latest: ${batch[batch.length - 1].body}`
              };
          
          showSingleNotification(batchData);
          pendingNotifications.current.delete(data.senderId);
        }
      }, 2000);
      return;
    }

    showSingleNotification(data);
  }, []);

  const showSingleNotification = useCallback(async (data: NotificationData) => {
    console.log('🔔 Showing enhanced notification:', data);
    
    const result = await platformNotificationManager.createNotification({
      title: data.title,
      body: data.body,
      icon: '/favicon.ico',
      tag: `chat-${data.channelId}`,
      requireInteraction: false,
      silent: false,
    });

    if (result.success) {
      console.log('✅ Enhanced notification shown successfully');
      lastNotificationTime.current = Date.now();
      
      // Clear any pending notifications for this sender
      pendingNotifications.current.delete(data.senderId);
    } else {
      console.error('❌ Enhanced notification failed:', result.error);
    }
  }, []);

  return {
    requestPermission,
    showNotification,
  };
};