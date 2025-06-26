
export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.log("Browser does not support notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    console.log("Notification permission already granted");
    return true;
  }
  
  if (Notification.permission === "default") {
    console.log("Requesting notification permission...");
    const permission = await Notification.requestPermission();
    sessionStorage.setItem("notification_permission", permission);
    console.log("Permission result:", permission);
    return permission === "granted";
  }

  console.log("Notification permission denied");
  return false; // 'denied'
};
