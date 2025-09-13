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

  // UNIFIED TIMESTAMP SYSTEM - only use Date.now() for consistency
  const now = () => Date.now();

  // BULLETPROOF SUPPRESSION SYSTEM
  // Global freeze during switches (prevents list churn)
  const freezeUntilRef = useRef<number>(0);
  const [freezeSnapshot, setFreezeSnapshot] = useState<Counts | null>(null);

  // Extended guard windows for slower networks/devices
  const quarantineRef = useRef<Map<string, number>>(new Map());
  const QUARANTINE_MS = 2000; // Extended for bulletproof coverage

  // Guard the channel being switched TO
  const switchingUntilRef = useRef<Map<string, number>>(new Map());
  const SWITCH_MS = 2000; // Extended

  // Guard the channel being switched FROM
  const leavingUntilRef = useRef<Map<string, number>>(new Map());
  const LEAVE_MS = 2000; // Extended

  // NUCLEAR OPTION: Force zero for any channel during interaction
  const nuclearSuppressUntilRef = useRef<Map<string, number>>(new Map());
  const NUCLEAR_MS = 2500; // Longest guard

  // reset on identity change
  useEffect(() => {
    countsRef.current = {};
    setCounts({});
    lastSeenRef.current.clear();
    freezeUntilRef.current = 0;
    setFreezeSnapshot(null);
    quarantineRef.current.clear();
    switchingUntilRef.current.clear();
    leavingUntilRef.current.clear();
    nuclearSuppressUntilRef.current.clear();
    seededRef.current = false;
  }, [ident]);

  const setCount = useCallback((cid: string, v: number) => {
    const next = { ...countsRef.current, [cid]: Math.max(0, v) };
    countsRef.current = next;
    setCounts(next);
  }, []);

  const get = useCallback(
    (cid: string) => {
      const nowTs = now();
      
      // BULLETPROOF SUPPRESSION: Check all guard levels
      // Level 1: Nuclear option (absolute zero during any interaction)
      if ((nuclearSuppressUntilRef.current.get(cid) || 0) > nowTs) return 0;
      
      // Level 2: Switching guards (channel-specific)
      if ((switchingUntilRef.current.get(cid) || 0) > nowTs) return 0;
      if ((leavingUntilRef.current.get(cid) || 0) > nowTs) return 0;

      // Level 3: Provider-level suppressions & active channel
      if (isChannelBadgeSuppressed?.(cid) || isChannelRecentlyCleared?.(cid)) return 0;
      if (currentChannelId === cid) return 0;

      // Level 4: Freeze snapshot during transitions
      if (freezeSnapshot && nowTs < freezeUntilRef.current) {
        return Math.max(0, freezeSnapshot[cid] || 0);
      }
      
      // Level 5: Current counts (always non-negative)
      return Math.max(0, countsRef.current[cid] || 0);
    },
    [freezeSnapshot, isChannelBadgeSuppressed, isChannelRecentlyCleared, currentChannelId]
  );

  // BULLETPROOF CHANNEL ENTRY: Call on any interaction (idempotent)
  const enterChannel = useCallback((nextCid: string, freezeMs = 1500) => {
    const ts = now();
    
    // IMMEDIATE VISUAL SUPPRESSION: Force zero synchronously
    lastSeenRef.current.set(nextCid, ts);

    // NUCLEAR OPTION: Absolutely force zero for this channel
    nuclearSuppressUntilRef.current.set(nextCid, ts + NUCLEAR_MS);

    // REDUNDANT SUPPRESSION: Multiple guard levels
    switchingUntilRef.current.set(nextCid, ts + SWITCH_MS);
    quarantineRef.current.set(nextCid, ts + QUARANTINE_MS);

    // Guard the channel we're leaving (current active), if any
    if (currentChannelId && currentChannelId !== nextCid) {
      leavingUntilRef.current.set(currentChannelId, ts + LEAVE_MS);
      nuclearSuppressUntilRef.current.set(currentChannelId, ts + NUCLEAR_MS);
      
      // Synchronously zero the leaving channel
      if ((countsRef.current[currentChannelId] || 0) !== 0) {
        countsRef.current[currentChannelId] = 0;
      }
    }

    // SYNCHRONOUS UPDATE: Zero immediately in all places
    const currentCounts = { ...countsRef.current, [nextCid]: 0 };
    countsRef.current = currentCounts;

    // Global freeze for visual stability
    freezeUntilRef.current = ts + freezeMs;
    setFreezeSnapshot(currentCounts);

    // Force immediate React update
    setCounts({ ...currentCounts });
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

  // PROVIDER SYNCHRONIZATION: Adopt zeros immediately, increases cautiously
  useEffect(() => {
    const nowTs = now();
    const frozen = nowTs < freezeUntilRef.current;

    setCounts(prev => {
      let changed = false;
      const next = { ...prev };

      for (const [cid, pv] of Object.entries(providerUnreads || {})) {
        const cur = next[cid] || 0;

        // BULLETPROOF RULE: Zeros always win immediately
        if ((pv || 0) === 0 && cur !== 0) {
          next[cid] = 0;
          changed = true;
          continue;
        }

        // CAUTIOUS ADOPTION: Provider increases only if ALL guards are clear
        if (pv > cur && !frozen && cid !== currentChannelId) {
          const qUntil = quarantineRef.current.get(cid) || 0;
          const swUntil = switchingUntilRef.current.get(cid) || 0;
          const lvUntil = leavingUntilRef.current.get(cid) || 0;
          const nuclearUntil = nuclearSuppressUntilRef.current.get(cid) || 0;
          
          // All suppression mechanisms must be clear
          if (nowTs > qUntil && nowTs > swUntil && nowTs > lvUntil && nowTs > nuclearUntil) {
            next[cid] = pv;
            changed = true;
          }
        }
      }

      // ENFORCED RULE: Active channel is always zero
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
        // Clear all guards for active channel (no suppression needed)
        switchingUntilRef.current.delete(cid);
        leavingUntilRef.current.delete(cid);
        nuclearSuppressUntilRef.current.delete(cid);
        return;
      }

      // Only count if newer than lastSeen
      const lastSeen = lastSeenRef.current.get(cid) || 0;
      if (createdAt <= lastSeen) return;

      // REAL NEW MESSAGE: Clear all suppression for that channel (allows instant reaction)
      switchingUntilRef.current.delete(cid);
      leavingUntilRef.current.delete(cid);
      quarantineRef.current.delete(cid);
      nuclearSuppressUntilRef.current.delete(cid);

      setCount(cid, (countsRef.current[cid] || 0) + 1);
    };

    window.addEventListener('chat-message-received', onMsg as EventListener);
    return () => window.removeEventListener('chat-message-received', onMsg as EventListener);
  }, [currentChannelId, setCount, meId, meType, userChannels]);

  return { get, enterChannel, counts };
}
