import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

type Counts = Record<string, number>;

export function useSidebarBadgeStore(opts: {
  boardOwnerId: string | null;
  meId?: string | null;
  currentChannelId: string | null;
  providerUnreads: Counts;
}) {
  const { boardOwnerId, meId, currentChannelId, providerUnreads } = opts;

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

  // full reset on identity change (same effect as a page refresh)
  useEffect(() => {
    countsRef.current = {};
    setCounts({});
    lastSeenRef.current.clear();
    freezeUntilRef.current = 0;
    setFreezeSnapshot(null);
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
    setCount(cid, 0);
    // freeze list for a tick while provider/server settles
    freezeUntilRef.current = nowMs() + freezeMs;
    setFreezeSnapshot({ ...countsRef.current, [cid]: 0 });
  }, [setCount]);

  // Seed once from provider (initial state). After that we ignore provider increases.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const snapshot: Counts = {};
    for (const [cid, v] of Object.entries(providerUnreads || {})) {
      snapshot[cid] = Math.max(0, v || 0);
    }
    countsRef.current = snapshot;
    setCounts(snapshot);
    seededRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ident]);

  // Always adopt provider zeros (never re-inflate)
  useEffect(() => {
    setCounts(prev => {
      let changed = false;
      const next = { ...prev };

      for (const [cid, v] of Object.entries(providerUnreads || {})) {
        if ((v || 0) === 0 && (next[cid] || 0) !== 0) {
          next[cid] = 0;
          changed = true;
        }
      }

      // active channel must always be zero in the sidebar
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

  // Increment on new messages, but gate by lastSeen and active channel
  useEffect(() => {
    const onMsg = (evt: any) => {
      const m = evt?.detail?.message;
      const cid: string | undefined = m?.channel_id;
      if (!cid) return;

      const createdAt = m?.created_at ? new Date(m.created_at).getTime() : Date.now();

      // If it's the currently open channel, keep it zero and advance lastSeen
      if (currentChannelId === cid) {
        if ((countsRef.current[cid] || 0) !== 0) setCount(cid, 0);
        const prev = lastSeenRef.current.get(cid) || 0;
        if (createdAt > prev) lastSeenRef.current.set(cid, createdAt);
        return;
      }

      // Ignore messages that are not newer than lastSeen (we already "entered" after them)
      const lastSeen = lastSeenRef.current.get(cid) || 0;
      if (createdAt <= lastSeen) return;

      setCount(cid, (countsRef.current[cid] || 0) + 1);
    };

    window.addEventListener('chat-message-received', onMsg as EventListener);
    return () => window.removeEventListener('chat-message-received', onMsg as EventListener);
  }, [currentChannelId, setCount]);

  return { get, enterChannel, counts };
}
