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

  // freeze snapshot during switch
  const freezeUntilRef = useRef<number>(0);
  const [freezeSnapshot, setFreezeSnapshot] = useState<Counts | null>(null);
  const nowMs = () =>
    (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // quarantines: ignore provider increases for a short time after entering
  const quarantineRef = useRef<Map<string, number>>(new Map());
  const QUARANTINE_MS = 1000;

  // NEW: guard the channel being switched to (covers cases where pointerdown doesn't fire in time)
  const switchingUntilRef = useRef<Map<string, number>>(new Map());
  const SWITCH_MS = 1200;

  // reset on identity change
  useEffect(() => {
    countsRef.current = {};
    setCounts({});
    lastSeenRef.current.clear();
    freezeUntilRef.current = 0;
    setFreezeSnapshot(null);
    quarantineRef.current.clear();
    switchingUntilRef.current.clear();
    seededRef.current = false;
  }, [ident]);

  const setCount = useCallback((cid: string, v: number) => {
    const next = { ...countsRef.current, [cid]: Math.max(0, v) };
    countsRef.current = next;
    setCounts(next);
  }, []);

  const get = useCallback(
    (cid: string) => {
      // If we are in a switch-guard window for this channel, force 0
      const swUntil = switchingUntilRef.current.get(cid) || 0;
      if (swUntil && Date.now() < swUntil) return 0;

      // Provider-level suppressions & active channel are always 0
      if (isChannelBadgeSuppressed?.(cid) || isChannelRecentlyCleared?.(cid)) return 0;
      if (currentChannelId === cid) return 0;

      if (freezeSnapshot && nowMs() < freezeUntilRef.current) {
        return Math.max(0, freezeSnapshot[cid] || 0);
      }
      return Math.max(0, countsRef.current[cid] || 0);
    },
    [freezeSnapshot, isChannelBadgeSuppressed, isChannelRecentlyCleared, currentChannelId]
  );

  // call on pre-interaction (pointer/mouse/touch/key) and again on click (idempotent)
  const enterChannel = useCallback((cid: string, freezeMs = 800) => {
    const ts = Date.now();
    lastSeenRef.current.set(cid, ts);

    // zero immediately
    const currentCounts = { ...countsRef.current, [cid]: 0 };
    countsRef.current = currentCounts;

    // freeze list briefly
    freezeUntilRef.current = nowMs() + freezeMs;
    setFreezeSnapshot(currentCounts);

    // start quarantine & switch guard for this channel
    quarantineRef.current.set(cid, Date.now() + QUARANTINE_MS);
    switchingUntilRef.current.set(cid, Date.now() + SWITCH_MS);

    setCounts({ ...currentCounts });
  }, []);

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
        if (pv > cur && !frozen && cid !== currentChannelId) {
          const qUntil = quarantineRef.current.get(cid) || 0;
          const swUntil = switchingUntilRef.current.get(cid) || 0;
          if (Date.now() > qUntil && Date.now() > swUntil) {
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

      // real new message → clear quarantine & switch guard
      if (quarantineRef.current.has(cid)) quarantineRef.current.delete(cid);
      if (switchingUntilRef.current.has(cid)) switchingUntilRef.current.delete(cid);

      setCount(cid, (countsRef.current[cid] || 0) + 1);
    };

    window.addEventListener('chat-message-received', onMsg as EventListener);
    return () => window.removeEventListener('chat-message-received', onMsg as EventListener);
  }, [currentChannelId, setCount, meId, meType, userChannels]);

  return { get, enterChannel, counts };
}