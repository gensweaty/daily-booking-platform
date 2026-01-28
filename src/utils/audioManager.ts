let audioContext: AudioContext | null = null;
let notificationBuffer: AudioBuffer | null = null;
let lastSoundPlayTime = 0;
let isPreloaded = false;
const MIN_SOUND_INTERVAL_MS = 2000; // 2 seconds debounce - prevents duplicate sounds

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
  const now = Date.now();
  
  // Debounce: skip if sound was played too recently
  if (now - lastSoundPlayTime < MIN_SOUND_INTERVAL_MS) {
    console.log('🔇 Skipping sound - played too recently (debounced)');
    return false;
  }
  
  lastSoundPlayTime = now;
  
  try {
    const context = initAudio();
    
    // Resume context if needed (required for user interaction on mobile)
    if (context.state === 'suspended') {
      console.log('📱 Resuming suspended audio context...');
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
    
    // Play for maximum 1 second: start(when, offset, duration)
    source.start(0, 0, 1.0);
    
    console.log('✅ Notification sound played (max 1s)');
    return true;
  } catch (error) {
    console.warn('❌ Error playing notification sound:', error);
    return false;
  }
};

// Preload the sound on first user interaction - CRITICAL for mobile
export const preloadNotificationSound = () => {
  if (isPreloaded) return;
  isPreloaded = true;
  
  console.log('📱 Preloading notification sound for mobile...');
  
  // Initialize audio context and load sound
  loadNotificationSound()
    .then(() => {
      // Try to resume context if suspended (for mobile)
      const context = initAudio();
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }
    })
    .catch(() => {
      // Silently fail if preload doesn't work
    });
};

// One-time first touch/click listener for mobile audio unlock
let touchListenerAdded = false;
export const addMobileAudioUnlockListener = () => {
  if (touchListenerAdded) return;
  touchListenerAdded = true;
  
  const unlockAudio = () => {
    console.log('📱 Mobile audio unlock triggered by user interaction');
    preloadNotificationSound();
    
    // Remove listeners after first interaction
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
  };
  
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  document.addEventListener('click', unlockAudio, { once: true, passive: true });
};