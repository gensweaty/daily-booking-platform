import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type PeerKey = `${string}_${'admin'|'sub_user'}`;

type Maps = {
  channel: Record<string, number>;
  peer: Record<PeerKey, number>;
  total: number;
};

export function useServerUnread(
  ownerId: string | null,
  viewerType: 'admin' | 'sub_user' | null,
  viewerId: string | null,
  realtimeBump?: { channelId?: string; createdAt?: string; senderType?: 'admin'|'sub_user'; senderId?: string; isSelf?: boolean },
  isExternalUser?: boolean,
  viewerEmail?: string | null
) {
  const [maps, setMaps] = useState<Maps>({ channel: {}, peer: {}, total: 0 });
  const [userChannels, setUserChannels] = useState<Set<string>>(new Set());
  const fetching = useRef(false);
  // Track local increments to prevent server refresh from erasing them
  const localIncrementsRef = useRef<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!ownerId || !viewerType || !viewerId || fetching.current) return;
    fetching.current = true;
    try {
      let effectiveViewerId = viewerId;
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (viewerType === 'sub_user' && !uuidRe.test(viewerId) && viewerEmail) {
        // resolve UUID via email (public board)
        const { data: su } = await supabase
          .from('sub_users')
          .select('id')
          .eq('board_owner_id', ownerId)
          .eq('email', viewerEmail)
          .maybeSingle();
        if (su?.id) effectiveViewerId = su.id;
      }

      // Fetch user's participating channels first
      const { data: participantData, error: participantError } = await supabase
        .from('chat_participants')
        .select('channel_id')
        .eq(viewerType === 'admin' ? 'user_id' : 'sub_user_id', effectiveViewerId)
        .eq('user_type', viewerType);

      if (participantError) throw participantError;

      const channelIds = new Set(participantData?.map(p => p.channel_id) || []);
      setUserChannels(channelIds);

      // Then fetch unread counters
      const { data, error } = await supabase.rpc('unread_counters', {
        p_owner_id: ownerId,
        p_viewer_type: viewerType,
        p_viewer_id: effectiveViewerId
      });
      if (error) throw error;

      const channel: Record<string, number> = {};
      const peer: Record<PeerKey, number> = {};

      (data ?? []).forEach((row: any) => {
        if (row.channel_id) {
          const serverCount = row.channel_unread ?? 0;
          const localCount = localIncrementsRef.current[row.channel_id] ?? 0;
          // Use the HIGHER count (server or local) to prevent flicker
          channel[row.channel_id] = Math.max(serverCount, localCount);
        }
        if (row.peer_id && row.peer_type) {
          const key = `${row.peer_id}_${row.peer_type}` as PeerKey;
          peer[key] = (peer[key] ?? 0) + (row.peer_unread ?? 0);
        }
      });

      const total = Object.values(channel).reduce((s, n) => s + (n || 0), 0);
      setMaps({ channel, peer, total });
    } catch (error) {
      console.error('Error fetching unread counters:', error);
    } finally {
      fetching.current = false;
    }
  }, [ownerId, viewerType, viewerId, viewerEmail]);

  // Initial + periodic refresh - optimized to prevent flickering
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    // Much less frequent refresh to prevent chat icon flickering
    const refreshInterval = isExternalUser ? 30_000 : 60_000; 
    const id = setInterval(refresh, refreshInterval);
    return () => clearInterval(id);
  }, [refresh, isExternalUser]);

  // Realtime bump (optimistic) - SIMPLIFIED for instant badge appearance
  useEffect(() => {
    const b = realtimeBump;
    if (!b || !b.channelId || b.isSelf) return;
    
    // For external users, always allow realtime bumps and refresh participation if needed
    if (isExternalUser && !userChannels.has(b.channelId)) {
      console.log('🔄 External user - refreshing participation for new channel:', b.channelId);
      refresh(); // Refresh immediately to pick up new channel participation
      return;
    }
    
    // SIMPLIFIED: If we received a realtime bump, trust it and increment immediately
    // The fact that we got the bump means the user IS a participant (or it's an AI message)
    // Remove aggressive participation checks - they prevent instant badge appearance
    
    console.log('📈 Incrementing unread for channel via realtime:', b.channelId);
    
    // Track local increment to prevent server refresh from erasing it
    localIncrementsRef.current[b.channelId] = 
      (localIncrementsRef.current[b.channelId] ?? 0) + 1;
    
    setMaps(prev => {
      const channel = { ...prev.channel, [b.channelId]: (prev.channel[b.channelId] ?? 0) + 1 };
      const peer = { ...prev.peer };
      
      // Only attribute to peer if it's not a custom chat (avoid DM attribution for custom chats)
      if (b.senderId && b.senderType && !b.senderId.startsWith('custom_')) {
        const key = `${b.senderId}_${b.senderType}` as PeerKey;
        peer[key] = (peer[key] ?? 0) + 1;
      }
      
      const total = Object.values(channel).reduce((s, n) => s + (n || 0), 0);
      return { channel, peer, total };
    });
  }, [realtimeBump, userChannels, isExternalUser, refresh]);

  const clearChannel = useCallback((channelId: string) => {
    console.log('🧹 Clearing channel:', channelId);
    
    // Clear local increment tracking when channel is opened
    delete localIncrementsRef.current[channelId];
    
    setMaps(prev => {
      if (!prev.channel[channelId]) return prev;
      const channel = { ...prev.channel };
      delete channel[channelId];
      const total = Object.values(channel).reduce((s, n) => s + (n || 0), 0);
      return { ...prev, channel, total };
    });
    
    // Immediate refresh to sync with server after clearing
    setTimeout(() => {
      console.log('🔄 Post-clear refresh for channel:', channelId);
      refresh();
    }, 100);
  }, [refresh]);

  const clearPeer = useCallback((peerId: string, peerType: 'admin'|'sub_user') => {
    const key = `${peerId}_${peerType}` as PeerKey;
    setMaps(prev => {
      if (!prev.peer[key]) return prev;
      const peer = { ...prev.peer }; delete peer[key];
      return { ...prev, peer };
    });
  }, []);

  const getPeerUnread = useCallback((peerId: string, peerType: 'admin'|'sub_user') =>
    maps.peer[`${peerId}_${peerType}` as PeerKey] ?? 0, [maps.peer]);

  return {
    channelUnreads: maps.channel,
    unreadTotal: maps.total,
    getPeerUnread,
    clearChannel,
    clearPeer,
    refresh,
    userChannels
  };
}