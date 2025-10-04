let audioContext: AudioContext | null = null;
let notificationBuffer: AudioBuffer | null = null;

const initAudio = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

const loadNotificationSound = async (): Promise<AudioBuffer | null> => {
  if (notificationBuffer) return notificationBuffer;
  
  try {
    const context = initAudio();
    const response = await fetch('/audio/notification.mp3');
    if (!response.ok) {
      console.warn('❌ Could not load notification sound:', response.status);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    notificationBuffer = await context.decodeAudioData(arrayBuffer);
    console.log('✅ Notification sound loaded successfully');
    return notificationBuffer;
  } catch (error) {
    console.warn('❌ Error loading notification sound:', error);
    return null;
  }
};

export const playNotificationSound = async (): Promise<boolean> => {
  try {
    const context = initAudio();
    
    // Resume context if needed (required for user interaction)
    if (context.state === 'suspended') {
      await context.resume();
    }
    
    const buffer = await loadNotificationSound();
    if (!buffer) return false;
    
    const source = context.createBufferSource();
    const gainNode = context.createGain();
    
    source.buffer = buffer;
    gainNode.gain.value = 0.5; // 50% volume
    
    source.connect(gainNode);
    gainNode.connect(context.destination);
    
    source.start(0);
    
    console.log('✅ Notification sound played');
    return true;
  } catch (error) {
    console.warn('❌ Error playing notification sound:', error);
    return false;
  }
};

// Preload the sound on first user interaction
export const preloadNotificationSound = () => {
  loadNotificationSound().catch(() => {
    // Silently fail if preload doesn't work
  });
};