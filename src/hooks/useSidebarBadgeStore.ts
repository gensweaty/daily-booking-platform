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

  // freeze snapshot during switch (prevents list churn)
  const freezeUntilRef = useRef<number>(0);
  const [freezeSnapshot, setFreezeSnapshot] = useState<Counts | null>(null);
  const nowMs = () =>
    (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // ignore provider increases for a bit after entering
  const quarantineRef = useRef<Map<string, number>>(new Map());
  const QUARANTINE_MS = 1400;

  // guard the channel being switched TO
  const switchingUntilRef = useRef<Map<string, number>>(new Map());
  const SWITCH_MS = 1300;

  // NEW: guard the channel being switched FROM
  const leavingUntilRef = useRef<Map<string, number>>(new Map());
  const LEAVE_MS = 1300;

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
    seededRef.current = false;
  }, [ident]);

  const setCount = useCallback((cid: string, v: number) => {
    const next = { ...countsRef.current, [cid]: Math.max(0, v) };
    countsRef.current = next;
    setCounts(next);
  }, []);

  const get = useCallback(
    (cid: string) => {
      const now = Date.now();
      // hard guards first
      if ((switchingUntilRef.current.get(cid) || 0) > now) return 0;
      if ((leavingUntilRef.current.get(cid) || 0) > now) return 0;

      if (isChannelBadgeSuppressed?.(cid) || isChannelRecentlyCleared?.(cid)) return 0;
      if (currentChannelId === cid) return 0;

      if (freezeSnapshot && nowMs() < freezeUntilRef.current) {
        return Math.max(0, freezeSnapshot[cid] || 0);
      }
      return Math.max(0, countsRef.current[cid] || 0);
    },
    [freezeSnapshot, isChannelBadgeSuppressed, isChannelRecentlyCleared, currentChannelId]
  );

  // call on pre-interaction; also safe to call again on click
  const enterChannel = useCallback((nextCid: string, freezeMs = 1100) => {
    const ts = Date.now();
    
    // FRESH START RESET - mimic page refresh behavior
    // Clear all badge counts to eliminate flicker
    const freshCounts: Counts = {};
    countsRef.current = freshCounts;
    
    // Reset all tracking state for clean start
    lastSeenRef.current.clear();
    quarantineRef.current.clear();
    switchingUntilRef.current.clear();
    leavingUntilRef.current.clear();
    
    // CRITICAL: Reset seeding to prevent provider interference
    seededRef.current = false;
    
    // Set fresh lastSeen for the channel we're entering
    lastSeenRef.current.set(nextCid, ts);
    
    // Guard ALL channels during transition (prevent ANY provider updates)
    for (const cid of userChannels) {
      switchingUntilRef.current.set(cid, ts + SWITCH_MS);
      quarantineRef.current.set(cid, ts + QUARANTINE_MS);
    }
    
    // Freeze with fresh state
    freezeUntilRef.current = nowMs() + freezeMs;
    setFreezeSnapshot(freshCounts);
    
    // Apply fresh state immediately
    setCounts(freshCounts);
  }, [userChannels]);

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

  // adopt provider zeros; cautiously adopt increases
  useEffect(() => {
    const now = nowMs();
    const frozen = now < freezeUntilRef.current;

    setCounts(prev => {
      let changed = false;
      const next = { ...prev };

      for (const [cid, pv] of Object.entries(providerUnreads || {})) {
        const cur = next[cid] || 0;

        // zeros always win
        if ((pv || 0) === 0 && cur !== 0) {
          next[cid] = 0;
          changed = true;
          continue;
        }

        // adopt provider increases only if:
        // - not frozen
        // - not the active channel
        // - outside quarantine
        // - outside switch-guard
        // - outside leaving-guard
        if (pv > cur && !frozen && cid !== currentChannelId) {
          const nowTs = Date.now();
          const qUntil = quarantineRef.current.get(cid) || 0;
          const swUntil = switchingUntilRef.current.get(cid) || 0;
          const lvUntil = leavingUntilRef.current.get(cid) || 0;
          if (nowTs > qUntil && nowTs > swUntil && nowTs > lvUntil) {
            next[cid] = pv;
            changed = true;
          }
        }
      }

      // active channel must always be zero
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

      // SPECIAL: Reminder alerts always increment badge, even if from "self"
      const isReminderAlert = m?.message_type === 'reminder_alert';
      
      // ignore own messages (except reminder alerts)
      if (!isReminderAlert) {
        if (meType === 'admin' && m?.sender_user_id && meId && m.sender_user_id === meId) return;
        if (meType === 'sub_user' && m?.sender_sub_user_id && meId && m.sender_sub_user_id === meId) return;
      }

      const createdAt = m?.created_at ? new Date(m.created_at).getTime() : Date.now();

      // active channel stays clear + advance lastSeen
      if (currentChannelId === cid) {
        if ((countsRef.current[cid] || 0) !== 0) setCount(cid, 0);
        const prevSeen = lastSeenRef.current.get(cid) || 0;
        if (createdAt > prevSeen) lastSeenRef.current.set(cid, createdAt);
        // entering/leaving guards not needed for active channel
        switchingUntilRef.current.delete(cid);
        leavingUntilRef.current.delete(cid);
        return;
      }

      // Only count if newer than lastSeen
      const lastSeen = lastSeenRef.current.get(cid) || 0;
      if (createdAt <= lastSeen) return;

      // real new message → clear guards for that channel
      switchingUntilRef.current.delete(cid);
      leavingUntilRef.current.delete(cid);
      quarantineRef.current.delete(cid);

      setCount(cid, (countsRef.current[cid] || 0) + 1);
    };

    window.addEventListener('chat-message-received', onMsg as EventListener);
    return () => window.removeEventListener('chat-message-received', onMsg as EventListener);
  }, [currentChannelId, setCount, meId, meType, userChannels]);

  return { get, enterChannel, counts };
}
