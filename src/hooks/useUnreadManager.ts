import { useState, useEffect, useCallback } from 'react';

interface UnreadCounts {
  [channelId: string]: number;
}

export const useUnreadManager = (currentChannelId?: string, isOpen?: boolean) => {
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [channelUnreads, setChannelUnreads] = useState<UnreadCounts>({});

  // Load unread counts from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chat_unread_counts');
    if (saved) {
      try {
        const counts: UnreadCounts = JSON.parse(saved);
        setChannelUnreads(counts);
        setUnreadTotal(Object.values(counts).reduce((sum, count) => sum + count, 0));
      } catch (error) {
        console.error('Failed to load unread counts:', error);
      }
    }
  }, []);

  // Save unread counts to localStorage
  useEffect(() => {
    localStorage.setItem('chat_unread_counts', JSON.stringify(channelUnreads));
  }, [channelUnreads]);

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

  // Update total when channel unreads change
  useEffect(() => {
    const total = Object.values(channelUnreads).reduce((sum, count) => sum + (count as number), 0);
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