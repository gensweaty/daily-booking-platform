import { supabase } from '@/integrations/supabase/client';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

let registration: ServiceWorkerRegistration | null = null;

// VAPID public key from environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert base64 VAPID key to Uint8Array compatible with PushManager
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(userId?: string): Promise<PushSubscriptionData | null> {
  if (!registration) {
    console.error('[Push] No service worker registration found');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VAPID public key not configured');
    return null;
  }

  try {
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Subscribe to push
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Extract subscription data
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    
    if (!p256dhKey || !authKey) {
      throw new Error('Failed to get subscription keys');
    }

    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhKey as ArrayBuffer))),
        auth: btoa(String.fromCharCode(...new Uint8Array(authKey as ArrayBuffer)))
      }
    };

    // Save to database via edge function
    if (userId) {
      await supabase.functions.invoke('subscribe-to-push', {
        body: {
          userId,
          subscription: subscriptionData,
          userAgent: navigator.userAgent
        }
      });
    }

    console.log('[Push] Subscription successful:', subscriptionData.endpoint);
    return subscriptionData;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId?: string): Promise<boolean> {
  if (!registration) return false;

  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Remove from database
      if (userId) {
        await supabase.functions.invoke('unsubscribe-from-push', {
          body: { userId, endpoint }
        });
      }

      console.log('[Push] Unsubscribed successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Check if push notifications are supported and permission granted
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.error('[Push] Notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Permission:', permission);
  return permission;
}

/**
 * Register service worker and handle push subscriptions
 */
export async function registerServiceWorker(userId?: string): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers not supported');
    return;
  }

  try {
    // Register service worker
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('[SW] Registered successfully:', registration.scope);

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Request notification permission
    const permission = await requestNotificationPermission();

    // Subscribe to push if permission granted
    if (permission === 'granted' && userId) {
      await subscribeToPush(userId);
    }

    // Handle service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available');
            // Optionally show update notification to user
          }
        });
      }
    });

  } catch (error) {
    console.error('[SW] Registration failed:', error);
  }
}

/**
 * Get current push subscription status
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Error getting subscription:', error);
    return null;
  }
}