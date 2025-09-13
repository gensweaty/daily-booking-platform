import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

type Counts = Record<string, number>;
type UserType = 'admin' | 'sub_user';

export function useSidebarBadgeStore(opts: {
  boardOwnerId: string | null;
  meId?: string | null;
  meType?: UserType | null;
  currentChannelId: string | null;
  providerUnreads: Counts;
  userChannels: Set<string>; // Add user channels to check participation
  isChannelBadgeSuppressed?: (channelId: string) => boolean;
  isChannelRecentlyCleared?: (channelId: string) => boolean;
}) {
  const { boardOwnerId, meId, meType, currentChannelId, providerUnreads, userChannels, isChannelBadgeSuppressed, isChannelRecentlyCleared } = opts;

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

  // post-read quarantine to prevent stale provider increases
  const quarantineRef = useRef<Map<string, number>>(new Map());
  const QUARANTINE_MS = 600;

  // immediate visual suppression for channel switching
  const visuallySuppressedRef = useRef<Set<string>>(new Set());

  // CRITICAL: Track channel being switched to (before currentChannelId updates)
  const switchingToRef = useRef<string | null>(null);

  // reset on identity change (same effect as a page refresh)
  useEffect(() => {
    countsRef.current = {};
    setCounts({});
    lastSeenRef.current.clear();
    freezeUntilRef.current = 0;
    setFreezeSnapshot(null);
    quarantineRef.current.clear();
    visuallySuppressedRef.current.clear();
    seededRef.current = false;
  }, [ident]);

  const setCount = useCallback((cid: string, v: number) => {
    const next = { ...countsRef.current, [cid]: Math.max(0, v) };
    countsRef.current = next;
    setCounts(next);
  }, []);

  const get = useCallback(
    (cid: string) => {
      // IMMEDIATE: Check if this is the channel being switched to (before currentChannelId updates)
      if (switchingToRef.current === cid) {
        return 0;
      }
      
      // IMMEDIATE: Check visual suppression first (no React dependency)
      if (visuallySuppressedRef.current.has(cid)) {
        return 0;
      }
      
      // IMMEDIATE: Check ChatProvider suppressions
      if (isChannelBadgeSuppressed?.(cid) || isChannelRecentlyCleared?.(cid)) {
        return 0;
      }
      
      // IMMEDIATE: Check if this is the active channel
      if (currentChannelId === cid) {
        return 0;
      }
      
      if (freezeSnapshot && nowMs() < freezeUntilRef.current) {
        return Math.max(0, freezeSnapshot[cid] || 0);
      }
      return Math.max(0, (countsRef.current[cid] || 0));
    },
    [freezeSnapshot, isChannelBadgeSuppressed, isChannelRecentlyCleared, currentChannelId]
  );

  // call on pointerdown of a channel row - INSTANT suppression
  const enterChannel = useCallback((cid: string, freezeMs = 240) => {
    const ts = Date.now();
    lastSeenRef.current.set(cid, ts);
    
    // INSTANT: Mark this as the channel being switched to
    switchingToRef.current = cid;
    
    // INSTANT: Triple-layer suppression for zero flicker
    visuallySuppressedRef.current.add(cid);
    
    // INSTANT: Zero the count immediately
    const currentCounts = { ...countsRef.current };
    currentCounts[cid] = 0;
    countsRef.current = currentCounts;
    
    // INSTANT: Set freeze snapshot with zero
    freezeUntilRef.current = nowMs() + freezeMs;
    setFreezeSnapshot(currentCounts);
    
    // INSTANT: Start quarantine
    quarantineRef.current.set(cid, Date.now() + QUARANTINE_MS);
    
    // Force immediate synchronous re-render of any components using this
    setCounts({ ...currentCounts });
    
    // Clear visual suppression after channel switch completes
    setTimeout(() => {
      visuallySuppressedRef.current.delete(cid);
    }, 1000); // Longer delay to ensure no flicker
    
    console.log('🔒 Badge store: INSTANT zero for channel:', cid, 'switching-to set, freeze until:', freezeUntilRef.current);
  }, []);

  // seed once from provider, but wait for actual data
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    
    // Only seed if we have actual provider data (not just empty object)
    const hasProviderData = providerUnreads && Object.keys(providerUnreads).length > 0;
    if (!hasProviderData) {
      console.log('🏪 Badge store: waiting for provider data to seed');
      return;
    }
    
    const snapshot: Counts = {};
    for (const [cid, v] of Object.entries(providerUnreads || {})) {
      snapshot[cid] = Math.max(0, v || 0);
    }
    
    console.log('🌱 Badge store: seeding with provider data:', snapshot);
    countsRef.current = snapshot;
    setCounts(snapshot);
    seededRef.current = true;
  }, [ident, providerUnreads]);

  // Always adopt provider zeros and active-channel zero.
  // Also adopt provider increases (missed bumps) when allowed (not frozen, not active).
  useEffect(() => {
    const now = nowMs();
    const frozen = now < freezeUntilRef.current;

    setCounts(prev => {
      let changed = false;
      const next = { ...prev };

      for (const [cid, pv] of Object.entries(providerUnreads || {})) {
        const cur = next[cid] || 0;

        // 1) zeros always win
        if ((pv || 0) === 0 && cur !== 0) {
          next[cid] = 0;
          changed = true;
          console.log('🔄 Badge store: adopting provider zero for channel:', cid);
          continue;
        }

        // 2) adopt provider increases if we somehow missed an event,
        //    but only when not frozen, not active channel, and not quarantined
        if (pv > cur && !frozen && cid !== currentChannelId) {
          const quarantineUntil = quarantineRef.current.get(cid) || 0;
          if (Date.now() > quarantineUntil) {
            next[cid] = pv;
            changed = true;
            console.log('🔄 Badge store: adopting provider increase for channel:', cid, 'from', cur, 'to', pv);
          }
        }
      }

      // 3) active channel must stay zero on the sidebar
      if (currentChannelId && (next[currentChannelId] || 0) !== 0) {
        next[currentChannelId] = 0;
        changed = true;
        console.log('🔄 Badge store: zeroing active channel:', currentChannelId);
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

      // CRITICAL: Only process messages from channels the user participates in
      if (!userChannels.has(cid)) {
        console.log('🚫 Badge store: ignoring message from non-participating channel:', cid);
        return;
      }

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
      if (createdAt <= lastSeen) {
        console.log('🚫 Badge store: message too old, ignoring:', cid, 'createdAt:', createdAt, 'lastSeen:', lastSeen);
        return;
      }

      // Clear quarantine for real new messages
      if (quarantineRef.current.has(cid)) {
        quarantineRef.current.delete(cid);
      }

      const newCount = (countsRef.current[cid] || 0) + 1;
      console.log('📈 Badge store: incrementing badge for channel:', cid, 'to:', newCount);
      setCount(cid, newCount);
    };

    window.addEventListener('chat-message-received', onMsg as EventListener);
    return () => window.removeEventListener('chat-message-received', onMsg as EventListener);
  }, [currentChannelId, setCount, meId, meType, userChannels]);

  return { get, enterChannel, counts };
}
