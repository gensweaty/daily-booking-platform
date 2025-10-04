import { useCallback, useEffect, useMemo, useState } from 'react';

type BadgeMap = Record<string, number>;

/**
 * Sidebar-only badge view model.
 * - Never blocks on provider updates.
 * - Adopts provider increases, adopts provider zeros.
 * - Local zero on click is immediate & authoritative until provider also reaches 0.
 */
export function useSidebarBadges(
  boardOwnerId: string | null,
  meId: string | undefined | null,
  channelUnreadsFromProvider: Record<string, number>,
  currentChannelId: string | null
) {
  // Optional persist key (scoped per owner + user). Persist is safe but not required.
  const persistKey = useMemo(() => {
    const uid = meId || 'anon';
    const owner = boardOwnerId || 'none';
    return `sbv2-badges:${owner}:${uid}`;
  }, [boardOwnerId, meId]);

  const [badges, setBadges] = useState<BadgeMap>(() => {
    try {
      const raw = localStorage.getItem(persistKey);
      return raw ? (JSON.parse(raw) as BadgeMap) : {};
    } catch {
      return {};
    }
  });

  // Persist (cheap)
  useEffect(() => {
    try { localStorage.setItem(persistKey, JSON.stringify(badges)); } catch {}
  }, [badges, persistKey]);

  // Seed/adopt from provider:
  // - if provider has bigger number -> adopt (increases)
  // - if provider has 0 -> adopt zero (decreases to zero)
  useEffect(() => {
    setBadges(prev => {
      const next = { ...prev };
      let changed = false;

      for (const [cid, prov] of Object.entries(channelUnreadsFromProvider || {})) {
        const p = Math.max(0, prov || 0);
        const cur = next[cid] || 0;
        if (p === 0 && cur !== 0) { next[cid] = 0; changed = true; continue; }
        if (p > cur) { next[cid] = p; changed = true; }
      }

      // Active channel must always appear read in the sidebar.
      if (currentChannelId && (next[currentChannelId] || 0) !== 0) {
        next[currentChannelId] = 0;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [channelUnreadsFromProvider, currentChannelId]);

  // Realtime/poll bumps via the existing global event your provider already fires.
  useEffect(() => {
    const handler = (evt: any) => {
      const message = evt?.detail?.message;
      const cid: string | undefined = message?.channel_id;
      if (!cid) return;

      setBadges(prev => {
        // Active channel is considered read
        if (currentChannelId === cid) {
          if ((prev[cid] || 0) !== 0) {
            return { ...prev, [cid]: 0 };
          }
          return prev;
        }
        return { ...prev, [cid]: (prev[cid] || 0) + 1 };
      });
    };

    window.addEventListener('chat-message-received', handler as EventListener);
    return () => window.removeEventListener('chat-message-received', handler as EventListener);
  }, [currentChannelId]);

  // Public API: zero immediately (used on pointerdown)
  const zeroNow = useCallback((channelId: string) => {
    setBadges(prev => {
      if ((prev[channelId] || 0) === 0) return prev;
      return { ...prev, [channelId]: 0 };
    });
  }, []);

  // Helper getter
  const get = useCallback((channelId: string) => Math.max(0, badges[channelId] || 0), [badges]);

  return { get, badges, zeroNow };
}