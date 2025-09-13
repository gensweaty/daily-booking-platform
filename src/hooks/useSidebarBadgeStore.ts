import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

type Counts = Record<string, number>;
type UserType = 'admin' | 'sub_user';

export function useSidebarBadgeStore(opts: {
  boardOwnerId: string | null;
  meId?: string | null;
  meType?: UserType | null;
  currentChannelId: string | null;
  providerUnreads: Counts;
  userChannels: Set<string>;
  isChannelBadgeSuppressed?: (channelId: string) => boolean;
  isChannelRecentlyCleared?: (channelId: string) => boolean;
}) {
  const {
    boardOwnerId,
    meId,
    meType,
    currentChannelId,
    providerUnreads,
    userChannels,
    isChannelBadgeSuppressed,
    isChannelRecentlyCleared
  } = opts;

  const ident = useMemo(
    () => `${boardOwnerId || 'none'}:${meId || 'anon'}`,
    [boardOwnerId, meId]
  );

  const [counts, setCounts] = useState<Counts>({});
  const countsRef = useRef<Counts>({});
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  // Simple visual suppression during channel switching - only affects display
  const visualSuppressionRef = useRef<Map<string, number>>(new Map());
  const SUPPRESSION_MS = 1500; // Brief visual suppression during switching

  // reset on identity change
  useEffect(() => {
    countsRef.current = {};
    setCounts({});
    lastSeenRef.current.clear();
    visualSuppressionRef.current.clear();
    seededRef.current = false;
  }, [ident]);

  const setCount = useCallback((cid: string, v: number) => {
    const next = { ...countsRef.current, [cid]: Math.max(0, v) };
    countsRef.current = next;
    setCounts(next);
  }, []);

  const get = useCallback(
    (cid: string) => {
      // Simple visual suppression check - only affects badge display
      const nowTs = Date.now();
      if ((visualSuppressionRef.current.get(cid) || 0) > nowTs) return 0;
      
      // Standard checks - don't interfere with core notification logic
      if (isChannelBadgeSuppressed?.(cid) || isChannelRecentlyCleared?.(cid)) return 0;
      if (currentChannelId === cid) return 0;
      
      return Math.max(0, countsRef.current[cid] || 0);
    },
    [isChannelBadgeSuppressed, isChannelRecentlyCleared, currentChannelId]
  );

  // Simple visual suppression during channel switching - doesn't affect data
  const enterChannel = useCallback((nextCid: string) => {
    const ts = Date.now();
    lastSeenRef.current.set(nextCid, ts);
    
    // Brief visual suppression of both entering and leaving channels
    visualSuppressionRef.current.set(nextCid, ts + SUPPRESSION_MS);
    if (currentChannelId && currentChannelId !== nextCid) {
      visualSuppressionRef.current.set(currentChannelId, ts + SUPPRESSION_MS);
    }
  }, [currentChannelId]);

  // seed once from provider
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const hasProviderData = providerUnreads && Object.keys(providerUnreads).length > 0;
    if (!hasProviderData) return;

    const snapshot: Counts = {};
    for (const [cid, v] of Object.entries(providerUnreads || {})) {
      snapshot[cid] = Math.max(0, v || 0);
    }
    countsRef.current = snapshot;
    setCounts(snapshot);
    seededRef.current = true;
  }, [ident, providerUnreads]);

  // Normal provider synchronization - don't interfere with core data
  useEffect(() => {
    setCounts(prev => {
      let changed = false;
      const next = { ...prev };

      for (const [cid, pv] of Object.entries(providerUnreads || {})) {
        const cur = next[cid] || 0;
        
        // Always adopt provider updates - let the provider handle the logic
        if ((pv || 0) !== cur) {
          next[cid] = Math.max(0, pv || 0);
          changed = true;
        }
      }

      // Active channel is always zero
      if (currentChannelId && (next[currentChannelId] || 0) !== 0) {
        next[currentChannelId] = 0;
        changed = true;
      }

      if (changed) {
        countsRef.current = next;
        return next;
      }
      return prev;
    });
  }, [providerUnreads, currentChannelId]);

  // realtime bumps
  useEffect(() => {
    const onMsg = (evt: any) => {
      const m = evt?.detail?.message;
      const cid: string | undefined = m?.channel_id;
      if (!cid) return;

      // only channels this user participates in
      if (!userChannels.has(cid)) return;

      // ignore own messages
      if (meType === 'admin' && m?.sender_user_id && meId && m.sender_user_id === meId) return;
      if (meType === 'sub_user' && m?.sender_sub_user_id && meId && m.sender_sub_user_id === meId) return;

      const createdAt = m?.created_at ? new Date(m.created_at).getTime() : Date.now();

      // active channel stays clear + advance lastSeen
      if (currentChannelId === cid) {
        if ((countsRef.current[cid] || 0) !== 0) setCount(cid, 0);
        const prevSeen = lastSeenRef.current.get(cid) || 0;
        if (createdAt > prevSeen) lastSeenRef.current.set(cid, createdAt);
        return;
      }

      // Only count if newer than lastSeen
      const lastSeen = lastSeenRef.current.get(cid) || 0;
      if (createdAt <= lastSeen) return;

      // Real new message clears visual suppression to show immediately
      visualSuppressionRef.current.delete(cid);

      setCount(cid, (countsRef.current[cid] || 0) + 1);
    };

    window.addEventListener('chat-message-received', onMsg as EventListener);
    return () => window.removeEventListener('chat-message-received', onMsg as EventListener);
  }, [currentChannelId, setCount, meId, meType, userChannels]);

  return { get, enterChannel, counts };
}
