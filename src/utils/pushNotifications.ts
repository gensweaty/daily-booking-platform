import { supabase } from '@/integrations/supabase/client';

export interface SendPushNotificationParams {
  userId: string;
  subUserId?: string;
  title: string;
  body: string;
  channelId?: string;
  type: 'chat' | 'reminder' | 'comment' | 'task' | 'booking';
  url?: string;
  icon?: string;
  requireInteraction?: boolean;
}

/**
 * Send a push notification to a user via edge function
 */
export async function sendPushNotification(params: SendPushNotificationParams): Promise<boolean> {
  try {
    console.log('[Push] Sending notification:', params);

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: params.userId,
        subUserId: params.subUserId,
        title: params.title,
        body: params.body,
        data: {
          channelId: params.channelId,
          type: params.type,
          url: params.url || '/',
        },
        icon: params.icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: `${params.type}-${params.channelId || 'notification'}`,
        requireInteraction: params.requireInteraction || false
      }
    });

    if (error) {
      console.error('[Push] Error sending notification:', error);
      return false;
    }

    console.log('[Push] Notification sent successfully:', data);
    return true;
  } catch (error) {
    console.error('[Push] Failed to send notification:', error);
    return false;
  }
}

/**
 * Send push notification for new chat message
 */
export async function sendChatPushNotification(
  userId: string,
  subUserId: string | undefined,
  senderName: string,
  message: string,
  channelId: string
): Promise<void> {
  await sendPushNotification({
    userId,
    subUserId,
    title: `New message from ${senderName}`,
    body: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
    channelId,
    type: 'chat',
    url: `/?openChat=${channelId}`
  });
}

/**
 * Send push notification for reminder
 */
export async function sendReminderPushNotification(
  userId: string,
  title: string,
  message: string
): Promise<void> {
  await sendPushNotification({
    userId,
    title: `⏰ ${title}`,
    body: message,
    type: 'reminder',
    requireInteraction: true
  });
}

/**
 * Send push notification for comment
 */
export async function sendCommentPushNotification(
  userId: string,
  commenterName: string,
  taskTitle: string,
  comment: string
): Promise<void> {
  await sendPushNotification({
    userId,
    title: `💬 New comment from ${commenterName}`,
    body: `On "${taskTitle}": ${comment.substring(0, 80)}`,
    type: 'comment'
  });
}

/**
 * Send push notification for task assignment
 */
export async function sendTaskPushNotification(
  userId: string,
  taskTitle: string,
  assignedBy: string
): Promise<void> {
  await sendPushNotification({
    userId,
    title: '📋 New task assigned',
    body: `${assignedBy} assigned you "${taskTitle}"`,
    type: 'task'
  });
}

/**
 * Send push notification for booking request
 */
export async function sendBookingPushNotification(
  userId: string,
  requesterName: string,
  bookingTitle: string
): Promise<void> {
  await sendPushNotification({
    userId,
    title: '📅 New booking request',
    body: `${requesterName} requested "${bookingTitle}"`,
    type: 'booking'
  });
}