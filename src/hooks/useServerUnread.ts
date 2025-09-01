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
  realtimeBump?: { channelId?: string; createdAt?: string; senderType?: 'admin'|'sub_user'; senderId?: string; isSelf?: boolean }
) {
  const [maps, setMaps] = useState<Maps>({ channel: {}, peer: {}, total: 0 });
  const fetching = useRef(false);

  const refresh = useCallback(async () => {
    if (!ownerId || !viewerType || !viewerId || fetching.current) return;
    fetching.current = true;
    try {
      const { data, error } = await supabase.rpc('unread_counters', {
        p_owner_id: ownerId,
        p_viewer_type: viewerType,
        p_viewer_id: viewerId
      });
      if (error) throw error;

      const channel: Record<string, number> = {};
      const peer: Record<PeerKey, number> = {};

      (data ?? []).forEach((row: any) => {
        if (row.channel_id) channel[row.channel_id] = row.channel_unread ?? 0;
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
  }, [ownerId, viewerType, viewerId]);

  // Initial + periodic refresh
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = setInterval(refresh, 25_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Realtime bump (optimistic)
  useEffect(() => {
    const b = realtimeBump;
    if (!b || !b.channelId || b.isSelf) return;
    setMaps(prev => {
      const channel = { ...prev.channel, [b.channelId]: (prev.channel[b.channelId] ?? 0) + 1 };
      const peer = { ...prev.peer };
      if (b.senderId && b.senderType) {
        const key = `${b.senderId}_${b.senderType}` as PeerKey;
        peer[key] = (peer[key] ?? 0) + 1;
      }
      const total = Object.values(channel).reduce((s, n) => s + (n || 0), 0);
      return { channel, peer, total };
    });
  }, [realtimeBump]);

  const clearChannel = useCallback((channelId: string) => {
    setMaps(prev => {
      if (!prev.channel[channelId]) return prev;
      const channel = { ...prev.channel }; delete channel[channelId];
      const total = Object.values(channel).reduce((s, n) => s + (n || 0), 0);
      return { ...prev, channel, total };
    });
  }, []);

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
    refresh
  };
}