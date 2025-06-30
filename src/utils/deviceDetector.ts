
export interface DeviceInfo {
  os: 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'unknown';
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';
  isMobile: boolean;
  isDesktop: boolean;
  supportsNotifications: boolean;
  supportsServiceWorker: boolean;
}

export interface NotificationCapabilities {
  hasPermission: boolean;
  canRequestPermission: boolean;
  supportsActions: boolean;
  supportsSound: boolean;
  supportsPersistent: boolean;
  supportsImage: boolean;
}

export const detectDevice = (): DeviceInfo => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  // OS Detection
  let os: DeviceInfo['os'] = 'unknown';
  if (userAgent.includes('windows')) {
    os = 'windows';
  } else if (userAgent.includes('mac os') || platform.startsWith('mac')) {
    os = 'macos';
  } else if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')) {
    os = 'ios';
  } else if (userAgent.includes('android')) {
    os = 'android';
  } else if (userAgent.includes('linux') && !userAgent.includes('android')) {
    os = 'linux';
  }

  // Browser Detection
  let browser: DeviceInfo['browser'] = 'unknown';
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    browser = 'chrome';
  } else if (userAgent.includes('firefox')) {
    browser = 'firefox';
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    browser = 'safari';
  } else if (userAgent.includes('edg')) {
    browser = 'edge';
  }

  // Device Type
  const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isDesktop = !isMobile;

  // Feature Support
  const supportsNotifications = 'Notification' in window;
  const supportsServiceWorker = 'serviceWorker' in navigator;

  return {
    os,
    browser,
    isMobile,
    isDesktop,
    supportsNotifications,
    supportsServiceWorker,
  };
};

export const getNotificationCapabilities = (): NotificationCapabilities => {
  const device = detectDevice();
  
  const hasPermission = device.supportsNotifications && Notification.permission === 'granted';
  const canRequestPermission = device.supportsNotifications && Notification.permission !== 'denied';
  
  // Platform-specific capabilities
  const supportsActions = device.browser === 'chrome' || device.browser === 'firefox';
  const supportsSound = device.os !== 'ios'; // iOS handles sound automatically
  const supportsPersistent = device.isDesktop;
  const supportsImage = device.browser === 'chrome' || device.browser === 'firefox';

  return {
    hasPermission,
    canRequestPermission,
    supportsActions,
    supportsSound,
    supportsPersistent,
    supportsImage,
  };
};

export const getPlatformInstructions = (): string => {
  const device = detectDevice();
  
  switch (device.os) {
    case 'windows':
      return 'Allow notifications in Windows Settings → System → Notifications & actions, then refresh this page.';
    case 'macos':
      return 'Enable notifications in System Preferences → Notifications → Safari/Chrome, then refresh this page.';
    case 'ios':
      return 'Enable notifications in Settings → Safari → Notifications, then refresh this page.';
    case 'android':
      return 'Allow notifications in Chrome Settings → Site Settings → Notifications, then refresh this page.';
    case 'linux':
      return 'Enable notifications in your browser settings, then refresh this page.';
    default:
      return 'Please enable notifications in your browser settings, then refresh this page.';
  }
};
