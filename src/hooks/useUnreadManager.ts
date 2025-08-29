import { useState, useEffect, useCallback } from 'react';

interface UnreadCounts {
  [channelId: string]: number;
}

export const useUnreadManager = (currentChannelId?: string, isOpen?: boolean) => {
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [channelUnreads, setChannelUnreads] = useState<UnreadCounts>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Enhanced load unread counts from localStorage with better error handling
  useEffect(() => {
    console.log('📊 useUnreadManager: Loading unread counts from localStorage');
    
    // Use multiple localStorage keys for different contexts (public board vs dashboard)
    const currentPath = window.location.pathname;
    const isPublicBoard = currentPath.startsWith('/board/');
    const storageKey = isPublicBoard ? `chat_unread_counts_public_${currentPath.split('/').pop()}` : 'chat_unread_counts';
    
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const counts: UnreadCounts = JSON.parse(saved);
        console.log('📊 useUnreadManager: Loaded counts for context:', { storageKey, counts });
        setChannelUnreads(counts);
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        setUnreadTotal(total);
        console.log('📊 useUnreadManager: Total unread count:', total);
      } catch (error) {
        console.error('Failed to load unread counts:', error);
        // Reset to clean state on error
        setChannelUnreads({});
        setUnreadTotal(0);
      }
    } else {
      console.log('📊 useUnreadManager: No saved unread counts found for context:', storageKey);
    }
    setIsInitialized(true);
  }, []);

  // Save unread counts to localStorage with initialization check
  useEffect(() => {
    if (isInitialized) {
      const currentPath = window.location.pathname;
      const isPublicBoard = currentPath.startsWith('/board/');
      const storageKey = isPublicBoard ? `chat_unread_counts_public_${currentPath.split('/').pop()}` : 'chat_unread_counts';
      
      console.log('💾 useUnreadManager: Saving unread counts to localStorage:', { storageKey, channelUnreads });
      localStorage.setItem(storageKey, JSON.stringify(channelUnreads));
    }
  }, [channelUnreads, isInitialized]);

  // Reset unread count for active channel when chat is opened
  useEffect(() => {
    if (isOpen && currentChannelId && channelUnreads[currentChannelId] > 0) {
      console.log('📖 Marking channel as read:', currentChannelId);
      setChannelUnreads(prev => {
        const updated = { ...prev };
        delete updated[currentChannelId];
        return updated;
      });
    }
  }, [isOpen, currentChannelId, channelUnreads]);

  // Update total when channel unreads change with better logging
  useEffect(() => {
    const total = Object.values(channelUnreads).reduce((sum, count) => sum + (count as number), 0);
    console.log('📊 useUnreadManager: Updating total unread count:', total, 'from channels:', channelUnreads);
    setUnreadTotal(total);
  }, [channelUnreads]);

  const incrementUnread = useCallback((channelId: string) => {
    console.log('📈 Incrementing unread for channel:', channelId);
    setChannelUnreads(prev => ({
      ...prev,
      [channelId]: (prev[channelId] || 0) + 1
    }));
  }, []);

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