import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

type Counts = Record<string, number>;
type UserType = 'admin' | 'sub_user';

export function useSidebarBadgeStore(opts: {
  boardOwnerId: string | null;
  meId?: string | null;
  meType?: UserType | null;
  currentChannelId: string | null;
  providerUnreads: Counts;
}) {
  const { boardOwnerId, meId, meType, currentChannelId, providerUnreads } = opts;

  const ident = useMemo(
    () => `${boardOwnerId || 'none'}:${meId || 'anon'}`,
    [boardOwnerId, meId]
  );

  const [counts, setCounts] = useState<Counts>({});
  const countsRef = useRef<Counts>({});
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  // short freeze window around a channel switch to avoid transient flashes
  const freezeUntilRef = useRef<number>(0);
  const [freezeSnapshot, setFreezeSnapshot] = useState<Counts | null>(null);
  const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // NEW: post-read quarantine to avoid re-adopting stale provider increases
  const quarantineRef = useRef<Map<string, number>>(new Map());
  const QUARANTINE_MS = 600; // keep this tight so legit missed-provider bumps aren't delayed long

  // reset on identity change (same effect as a page refresh)
  useEffect(() => {
    countsRef.current = {};
    setCounts({});
    lastSeenRef.current.clear();
    freezeUntilRef.current = 0;
    setFreezeSnapshot(null);
    quarantineRef.current.clear();
    seededRef.current = false;
  }, [ident]);

  const setCount = useCallback((cid: string, v: number) => {
    const next = { ...countsRef.current, [cid]: Math.max(0, v) };
    countsRef.current = next;
    setCounts(next);
  }, []);

  const get = useCallback(
    (cid: string) => {
      if (freezeSnapshot && nowMs() < freezeUntilRef.current) {
        return Math.max(0, freezeSnapshot[cid] || 0);
      }
      return Math.max(0, (countsRef.current[cid] || 0));
    },
    [freezeSnapshot]
  );

  // call on pointerdown of a channel row
  const enterChannel = useCallback((cid: string, freezeMs = 240) => {
    const ts = Date.now();
    lastSeenRef.current.set(cid, ts);

    // Immediately zero the count and create freeze snapshot with zero
    const currentCounts = { ...countsRef.current, [cid]: 0 };
    countsRef.current = currentCounts;

    // Freeze the list briefly while server/provider settles
    freezeUntilRef.current = nowMs() + freezeMs;
    setFreezeSnapshot(currentCounts);

    // NEW: start a short quarantine to ignore stale provider increases for this channel
    quarantineRef.current.set(cid, Date.now() + QUARANTINE_MS);

    // Update React state
    setCounts(currentCounts);
  }, []);

  // seed once from provider, but wait for actual data
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

  // Always adopt provider zeros and active-channel zero.
  // Also adopt provider increases (missed bumps) when allowed.
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

        // adopt provider increases if:
        // - not frozen
        // - not active channel
        // - NOT inside post-read quarantine window
        if (pv > cur && !frozen && cid !== currentChannelId) {
          const until = quarantineRef.current.get(cid) || 0;
          if (Date.now() > until) {
            next[cid] = pv;
            changed = true;
          } else {
            // still quarantined: skip adopting stale provider bump
          }
        }
      }

      // active channel must stay zero on the sidebar
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

  // Increment on new messages, ignore own messages, gate by lastSeen and active channel
  useEffect(() => {
    const onMsg = (evt: any) => {
      const m = evt?.detail?.message;
      const cid: string | undefined = m?.channel_id;
      if (!cid) return;

      // Ignore own messages so you don't badge yourself
      if (meType === 'admin' && m?.sender_user_id && meId && m.sender_user_id === meId) {
        console.log('🚫 Badge store: ignoring own message from admin:', meId);
        return;
      }
      if (meType === 'sub_user' && m?.sender_sub_user_id && meId && m.sender_sub_user_id === meId) {
        console.log('🚫 Badge store: ignoring own message from sub_user:', meId);
        return;
      }

      const createdAt = m?.created_at ? new Date(m.created_at).getTime() : Date.now();

      // Active channel stays clear; also advance lastSeen so later bumps compare correctly
      if (currentChannelId === cid) {
        if ((countsRef.current[cid] || 0) !== 0) setCount(cid, 0);
        const prevSeen = lastSeenRef.current.get(cid) || 0;
        if (createdAt > prevSeen) lastSeenRef.current.set(cid, createdAt);
        console.log('📱 Badge store: message in active channel, keeping zero:', cid);
        return;
      }

      // Only count if strictly newer than our lastSeen for that channel
      const lastSeen = lastSeenRef.current.get(cid) || 0;
      if (createdAt <= lastSeen) return;

      // We have a *real* new message → clear any quarantine for this channel
      if (quarantineRef.current.has(cid)) {
        quarantineRef.current.delete(cid);
      }

      setCount(cid, (countsRef.current[cid] || 0) + 1);
    };

    window.addEventListener('chat-message-received', onMsg as EventListener);
    return () => window.removeEventListener('chat-message-received', onMsg as EventListener);
  }, [currentChannelId, setCount, meId, meType]);

  return { get, enterChannel, counts };
}
