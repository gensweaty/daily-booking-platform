export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'unknown';
  effectiveType: '2g' | '3g' | '4g' | 'unknown';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export const detectNetworkQuality = (): NetworkInfo => {
  // Check if we're in a browser environment
  if (typeof navigator === 'undefined') {
    return {
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: 10,
      rtt: 100,
      saveData: false
    };
  }

  // Modern network information API
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;
  
  if (connection) {
    return {
      type: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 10,
      rtt: connection.rtt || 100,
      saveData: connection.saveData || false
    };
  }

  // Fallback: detect mobile user agent
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
  
  return {
    type: isMobile ? 'cellular' : 'wifi',
    effectiveType: 'unknown',
    downlink: isMobile ? 1.5 : 10,
    rtt: isMobile ? 300 : 100,
    saveData: false
  };
};

export const isSlowNetwork = (networkInfo?: NetworkInfo): boolean => {
  const info = networkInfo || detectNetworkQuality();
  return (
    info.effectiveType === '2g' || 
    info.effectiveType === '3g' ||
    info.downlink < 2 ||
    info.rtt > 200 ||
    info.saveData
  );
};

export const getOptimalPageSize = (networkInfo?: NetworkInfo): number => {
  const info = networkInfo || detectNetworkQuality();
  
  if (isSlowNetwork(info)) {
    return 20; // Smaller pages for slow networks
  }
  
  if (info.effectiveType === '4g' || info.downlink > 5) {
    return 50; // Larger pages for fast networks
  }
  
  return 30; // Default page size
};

export const getOptimalPollingInterval = (networkInfo?: NetworkInfo): number => {
  const info = networkInfo || detectNetworkQuality();
  
  if (isSlowNetwork(info)) {
    return 5000; // 5 seconds for slow networks
  }
  
  return 2500; // 2.5 seconds for normal networks
};