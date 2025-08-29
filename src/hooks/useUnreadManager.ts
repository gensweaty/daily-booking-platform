import { useState, useEffect, useCallback } from 'react';

interface UnreadCounts {
  [channelId: string]: number;
}

interface LastSeenTimes {
  [channelId: string]: number;
}

export const useUnreadManager = (currentChannelId?: string, isOpen?: boolean) => {
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [channelUnreads, setChannelUnreads] = useState<UnreadCounts>({});
  const [lastSeenTimes, setLastSeenTimes] = useState<LastSeenTimes>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // SURGICAL FIX 5: Persist "last seen" + unread per board/channel
  const getStorageKeys = () => {
    const currentPath = window.location.pathname;
    const isPublicBoard = currentPath.startsWith('/board/');
    const slug = isPublicBoard ? currentPath.split('/').pop() : 'dashboard';
    return {
      unreadKey: `sb:${slug}:unread`,
      lastSeenKey: `sb:${slug}:lastSeen`
    };
  };

  // Load from localStorage
  useEffect(() => {
    console.log('📊 useUnreadManager: Loading from localStorage');
    const { unreadKey, lastSeenKey } = getStorageKeys();
    
    // Load unread counts
    const savedUnread = localStorage.getItem(unreadKey);
    if (savedUnread) {
      try {
        const counts: UnreadCounts = JSON.parse(savedUnread);
        console.log('📊 Loaded unread counts:', { unreadKey, counts });
        setChannelUnreads(counts);
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        setUnreadTotal(total);
      } catch (error) {
        console.error('Failed to load unread counts:', error);
        setChannelUnreads({});
        setUnreadTotal(0);
      }
    }
    
    // Load last seen times  
    const savedLastSeen = localStorage.getItem(lastSeenKey);
    if (savedLastSeen) {
      try {
        const times: LastSeenTimes = JSON.parse(savedLastSeen);
        console.log('📊 Loaded last seen times:', { lastSeenKey, times });
        setLastSeenTimes(times);
      } catch (error) {
        console.error('Failed to load last seen times:', error);
        setLastSeenTimes({});
      }
    }
    
    setIsInitialized(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isInitialized) {
      const { unreadKey, lastSeenKey } = getStorageKeys();
      
      console.log('💾 Saving unread counts:', { unreadKey, channelUnreads });
      localStorage.setItem(unreadKey, JSON.stringify(channelUnreads));
      
      console.log('💾 Saving last seen times:', { lastSeenKey, lastSeenTimes });
      localStorage.setItem(lastSeenKey, JSON.stringify(lastSeenTimes));
    }
  }, [channelUnreads, lastSeenTimes, isInitialized]);

  // Update lastSeenAt when chat is open on a channel
  useEffect(() => {
    if (isOpen && currentChannelId) {
      const now = Date.now();
      console.log('📖 Updating last seen for channel:', currentChannelId, 'at:', new Date(now));
      setLastSeenTimes(prev => ({
        ...prev,
        [currentChannelId]: now
      }));
      
      // Clear unread count for this channel
      if (channelUnreads[currentChannelId] > 0) {
        console.log('📖 Clearing unread count for active channel:', currentChannelId);
        setChannelUnreads(prev => {
          const updated = { ...prev };
          delete updated[currentChannelId];
          return updated;
        });
      }
    }
  }, [isOpen, currentChannelId, channelUnreads]);

  // Update total when channel unreads change
  useEffect(() => {
    const total = Object.values(channelUnreads).reduce((sum, count) => sum + (count as number), 0);
    console.log('📊 Total unread count updated:', total, 'from channels:', channelUnreads);
    setUnreadTotal(total);
  }, [channelUnreads]);

  const incrementUnread = useCallback((channelId: string, messageTimestamp?: string) => {
    // Only increment if message is newer than last seen time
    const messageTime = messageTimestamp ? new Date(messageTimestamp).getTime() : Date.now();
    const lastSeen = lastSeenTimes[channelId] || 0;
    
    if (messageTime > lastSeen) {
      console.log('📈 Incrementing unread for channel:', channelId, 'message time:', new Date(messageTime), 'last seen:', new Date(lastSeen));
      setChannelUnreads(prev => ({
        ...prev,
        [channelId]: (prev[channelId] || 0) + 1
      }));
    } else {
      console.log('⏭️ Skipping unread increment - message older than last seen:', channelId);
    }
  }, [lastSeenTimes]);

  const clearChannelUnread = useCallback((channelId: string) => {
    console.log('🧹 Clearing unread for channel:', channelId);
    setChannelUnreads(prev => {
      const updated = { ...prev };
      delete updated[channelId];
      return updated;
    });
  }, []);

  const clearAllUnread = useCallback(() => {
    console.log('🧹 Clearing all unread counts');
    setChannelUnreads({});
    setUnreadTotal(0);
  }, []);

  return {
    unreadTotal,
    channelUnreads,
    incrementUnread,
    clearChannelUnread,
    clearAllUnread,
  };
};