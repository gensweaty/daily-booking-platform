
import { detectDevice, getNotificationCapabilities } from './deviceDetector';

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationResult {
  success: boolean;
  notification?: Notification;
  error?: string;
  fallbackUsed?: boolean;
}

class PlatformNotificationManager {
  private device = detectDevice();
  private capabilities = getNotificationCapabilities();

  async createNotification(options: NotificationOptions): Promise<NotificationResult> {
    console.log(`🔔 Creating notification for ${this.device.os} on ${this.device.browser}`);
    
    if (!this.capabilities.hasPermission) {
      return {
        success: false,
        error: 'Notification permission not granted',
      };
    }

    try {
      const notification = await this.createPlatformOptimizedNotification(options);
      return {
        success: true,
        notification,
      };
    } catch (error) {
      console.error('❌ Notification creation failed:', error);
      
      // Try fallback notification
      const fallbackResult = await this.createFallbackNotification(options);
      return {
        success: fallbackResult.success,
        notification: fallbackResult.notification,
        error: fallbackResult.success ? undefined : `Primary failed: ${error}. Fallback failed: ${fallbackResult.error}`,
        fallbackUsed: fallbackResult.success,
      };
    }
  }

  private async createPlatformOptimizedNotification(options: NotificationOptions): Promise<Notification> {
    const notificationOptions: NotificationOptions = {
      ...options,
      icon: options.icon || "/favicon.ico",
    };

    // Platform-specific optimizations
    switch (this.device.os) {
      case 'windows':
        notificationOptions.requireInteraction = true;
        notificationOptions.silent = false;
        break;
        
      case 'macos':
        notificationOptions.requireInteraction = this.capabilities.supportsPersistent;
        break;
        
      case 'ios':
        // iOS Safari handles most settings automatically
        notificationOptions.silent = true; // iOS handles sound
        delete notificationOptions.actions; // Not supported
        break;
        
      case 'android':
        notificationOptions.requireInteraction = false; // Android handles this
        if (this.capabilities.supportsActions && options.actions) {
          notificationOptions.actions = options.actions;
        }
        break;
        
      case 'linux':
        notificationOptions.requireInteraction = false;
        break;
    }

    // Remove unsupported features
    if (!this.capabilities.supportsActions) {
      delete notificationOptions.actions;
    }
    if (!this.capabilities.supportsImage) {
      delete notificationOptions.image;
    }

    console.log('🔔 Creating notification with options:', notificationOptions);
    const notification = new Notification(notificationOptions.title, notificationOptions);

    // Enhanced click handling
    notification.onclick = () => {
      console.log('🖱️ Notification clicked - focusing window');
      window.focus();
      notification.close();
    };

    notification.onshow = () => {
      console.log('👁️ Notification shown successfully');
      this.playNotificationSound();
    };

    notification.onerror = (error) => {
      console.error('❌ Notification error:', error);
    };

    // Auto-close for platforms that need it
    if (!this.capabilities.supportsPersistent) {
      setTimeout(() => {
        notification.close();
      }, 8000);
    }

    return notification;
  }

  private async createFallbackNotification(options: NotificationOptions): Promise<NotificationResult> {
    try {
      // Simple notification without advanced features
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/favicon.ico",
        tag: options.tag,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);

      return {
        success: true,
        notification,
      };
    } catch (error) {
      return {
        success: false,
        error: `Fallback notification failed: ${error}`,
      };
    }
  }

  async playNotificationSound(): Promise<void> {
    try {
      // Try modern Web Audio API first
      const { playNotificationSound } = await import('./audioManager');
      const played = await playNotificationSound();
      
      if (!played) {
        // Fallback to HTML Audio with 1 second limit
        const audio = new Audio('/audio/notification.mp3');
        audio.volume = 0.5;
        
        // Stop after 1 second
        const stopTimer = setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, 1000);
        
        audio.addEventListener('ended', () => clearTimeout(stopTimer), { once: true });
        await audio.play();
        console.log('✅ Notification sound played (fallback, max 1s)');
      }
    } catch (error) {
      console.warn('❌ Could not play notification sound:', error);
    }
  }

  getDeviceInfo() {
    return this.device;
  }

  getCapabilities() {
    return this.capabilities;
  }
}

export const platformNotificationManager = new PlatformNotificationManager();
