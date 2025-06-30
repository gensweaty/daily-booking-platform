
import { detectDevice, getPlatformInstructions, getNotificationCapabilities } from './deviceDetector';

export const ensureNotificationPermission = async (): Promise<boolean> => {
  const device = detectDevice();
  const capabilities = getNotificationCapabilities();
  
  if (!("Notification" in window)) {
    console.log("❌ Browser does not support notifications");
    return false;
  }
  
  if (capabilities.hasPermission) {
    console.log("✅ Notification permission already granted");
    return true;
  }
  
  if (!capabilities.canRequestPermission) {
    console.log("⛔ Notification permission denied");
    return false;
  }
  
  console.log(`🔔 Requesting notification permission for ${device.os} on ${device.browser}`);
  
  try {
    const permission = await Notification.requestPermission();
    sessionStorage.setItem("notification_permission", permission);
    console.log("🔔 Permission result:", permission);
    
    if (permission === "granted") {
      console.log("✅ Notification permission granted successfully");
      
      // Send a platform-optimized test notification
      setTimeout(() => {
        try {
          const testNotification = new Notification("🔔 Notifications Enabled", {
            body: `You'll now receive reminder notifications on your ${device.os} device`,
            icon: "/favicon.ico",
            tag: "permission-granted-test",
            requireInteraction: device.os === 'windows',
            silent: device.os === 'ios',
          });
          
          testNotification.onclick = () => {
            window.focus();
            testNotification.close();
          };
          
          setTimeout(() => testNotification.close(), 4000);
          console.log("✅ Test notification sent successfully");
        } catch (error) {
          console.error("❌ Test notification failed:", error);
        }
      }, 500);
    }
    
    return permission === "granted";
  } catch (error) {
    console.error("❌ Error requesting notification permission:", error);
    return false;
  }
};

export const getPermissionInstructions = (): string => {
  return getPlatformInstructions();
};

export const getDeviceSpecificMessage = (): string => {
  const device = detectDevice();
  
  switch (device.os) {
    case 'windows':
      return "Enable notifications to receive reminders on your Windows desktop";
    case 'macos':
      return "Enable notifications to receive reminders on your Mac";
    case 'ios':
      return "Enable notifications to receive reminders on your iPhone/iPad";
    case 'android':
      return "Enable notifications to receive reminders on your Android device";
    case 'linux':
      return "Enable notifications to receive reminders on your Linux desktop";
    default:
      return "Enable notifications to receive reminders on your device";
  }
};
