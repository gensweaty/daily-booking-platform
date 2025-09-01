import { useState, useEffect, useCallback } from 'react';

interface UnreadCounts {
  [channelId: string]: number;
}

interface LastSeenTimes {
  [channelId: string]: number;
}

interface MemberUnreads {
  [memberKey: string]: number; // memberKey format: "userId_userType"
}

export const useUnreadManager = (currentChannelId?: string, isOpen?: boolean, channelMemberMap?: Map<string, { id: string; type: 'admin' | 'sub_user' }>) => {
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [channelUnreads, setChannelUnreads] = useState<UnreadCounts>({});
  const [memberUnreads, setMemberUnreads] = useState<MemberUnreads>({});
  const [lastSeenTimes, setLastSeenTimes] = useState<LastSeenTimes>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // SURGICAL FIX 5: Persist "last seen" + unread per board/channel
  const getStorageKeys = () => {
    const currentPath = window.location.pathname;
    const isPublicBoard = currentPath.startsWith('/board/');
    const slug = isPublicBoard ? currentPath.split('/').pop() : 'dashboard';
    return {
      unreadKey: `sb:${slug}:unread`,
      lastSeenKey: `sb:${slug}:lastSeen`,
      memberUnreadKey: `sb:${slug}:memberUnread`
    };
  };

  // Load from localStorage
  useEffect(() => {
    console.log('📊 useUnreadManager: Loading from localStorage');
    const { unreadKey, lastSeenKey, memberUnreadKey } = getStorageKeys();
    
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
    
    // Load member unread counts
    const savedMemberUnread = localStorage.getItem(memberUnreadKey);
    if (savedMemberUnread) {
      try {
        const counts: MemberUnreads = JSON.parse(savedMemberUnread);
        console.log('📊 Loaded member unread counts:', { memberUnreadKey, counts });
        setMemberUnreads(counts);
      } catch (error) {
        console.error('Failed to load member unread counts:', error);
        setMemberUnreads({});
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
      const { unreadKey, lastSeenKey, memberUnreadKey } = getStorageKeys();
      
      console.log('💾 Saving unread counts:', { unreadKey, channelUnreads });
      localStorage.setItem(unreadKey, JSON.stringify(channelUnreads));
      
      console.log('💾 Saving member unread counts:', { memberUnreadKey, memberUnreads });
      localStorage.setItem(memberUnreadKey, JSON.stringify(memberUnreads));
      
      console.log('💾 Saving last seen times:', { lastSeenKey, lastSeenTimes });
      localStorage.setItem(lastSeenKey, JSON.stringify(lastSeenTimes));
    }
  }, [channelUnreads, memberUnreads, lastSeenTimes, isInitialized]);

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

  // Update member unreads when channel unreads change
  useEffect(() => {
    if (!channelMemberMap) return;
    
    const newMemberUnreads: MemberUnreads = {};
    
    // Aggregate channel unreads by member
    channelMemberMap.forEach((member, channelId) => {
      const unreadCount = channelUnreads[channelId] || 0;
      if (unreadCount > 0) {
        const memberKey = `${member.id}_${member.type}`;
        newMemberUnreads[memberKey] = (newMemberUnreads[memberKey] || 0) + unreadCount;
      }
    });
    
    console.log('📊 Updated member unreads:', { channelUnreads, newMemberUnreads });
    setMemberUnreads(newMemberUnreads);
  }, [channelUnreads, channelMemberMap]);

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

  const clearUserUnread = useCallback((userId: string, userType: 'admin' | 'sub_user') => {
    const memberKey = `${userId}_${userType}`;
    console.log('🧹 Clearing unread for member:', memberKey);
    
    // Clear all channels for this member
    if (channelMemberMap) {
      channelMemberMap.forEach((member, channelId) => {
        if (member.id === userId && member.type === userType) {
          setChannelUnreads(prev => {
            const updated = { ...prev };
            delete updated[channelId];
            return updated;
          });
        }
      });
    }
    
    // Clear member unread count
    setMemberUnreads(prev => {
      const updated = { ...prev };
      delete updated[memberKey];
      return updated;
    });
  }, [channelMemberMap]);

  const getUserUnreadCount = useCallback((userId: string, userType: 'admin' | 'sub_user'): number => {
    const memberKey = `${userId}_${userType}`;
    return memberUnreads[memberKey] || 0;
  }, [memberUnreads]);

  const clearAllUnread = useCallback(() => {
    console.log('🧹 Clearing all unread counts');
    setChannelUnreads({});
    setMemberUnreads({});
    setUnreadTotal(0);
  }, []);

  // NEW: hydrate from server (SQL function) on mount/refresh - MERGE with localStorage
  const hydrate = useCallback((rows: Array<{ 
    channel_id: string; 
    channel_unread: number; 
    peer_id: string | null; 
    peer_type: 'admin' | 'sub_user' | null; 
    peer_unread: number | null;
  }>) => {
    console.log('🔄 Hydrating unread counts from server:', rows);

    setChannelUnreads(prev => {
      const nextChannelUnreads: UnreadCounts = { ...prev };
      
      for (const r of rows) {
        if (r.channel_id && r.channel_unread > 0) {
          const currentCount = prev[r.channel_id] || 0;
          const serverCount = r.channel_unread;
          // Only use server count if it's higher than localStorage (handles refresh case)
          nextChannelUnreads[r.channel_id] = Math.max(currentCount, serverCount);
        }
      }
      
      return nextChannelUnreads;
    });

    setMemberUnreads(prev => {
      const nextMemberUnreads: MemberUnreads = { ...prev };
      
      for (const r of rows) {
        if (r.peer_id && r.peer_type && r.peer_unread && r.peer_unread > 0) {
          const k = `${r.peer_id}_${r.peer_type}`;
          const currentCount = prev[k] || 0;
          const serverCount = r.peer_unread;
          // Only use server count if it's higher than localStorage
          nextMemberUnreads[k] = Math.max(currentCount, serverCount);
        }
      }
      
      return nextMemberUnreads;
    });
  }, []);

  // NEW: mark a channel as seen immediately (for DMs & General)
  const markSeen = useCallback((channelId: string) => {
    const now = Date.now();
    setLastSeenTimes(prev => ({ ...prev, [channelId]: now }));
    setChannelUnreads(prev => {
      if (!prev[channelId]) return prev;
      const copy = { ...prev };
      delete copy[channelId];
      return copy;
    });
  }, []);

  return {
    unreadTotal,
    channelUnreads,
    memberUnreads,
    incrementUnread,
    clearChannelUnread,
    clearUserUnread,
    getUserUnreadCount,
    clearAllUnread,
    hydrate,       // ← export
    markSeen,      // ← export
  };
};