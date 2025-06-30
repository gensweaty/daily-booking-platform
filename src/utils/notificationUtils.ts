
export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.log("❌ Browser does not support notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    console.log("✅ Notification permission already granted");
    return true;
  }
  
  if (Notification.permission === "default") {
    console.log("🔔 Requesting notification permission from user...");
    try {
      const permission = await Notification.requestPermission();
      sessionStorage.setItem("notification_permission", permission);
      console.log("🔔 Permission result:", permission);
      
      if (permission === "granted") {
        console.log("✅ Notification permission granted successfully");
        
        // Send a test notification to confirm it works
        setTimeout(() => {
          try {
            const testNotification = new Notification("🔔 Notifications Enabled", {
              body: "You'll now receive reminder notifications",
              icon: "/favicon.ico",
              tag: "permission-granted-test",
            });
            
            setTimeout(() => testNotification.close(), 3000);
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
  }

  console.log("⛔ Notification permission denied");
  return false; // 'denied'
};
