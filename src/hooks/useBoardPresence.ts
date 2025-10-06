import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PresenceUser = {
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  online_at?: string | null;
};

type PresenceScope = "calendar" | "statistics" | "crm" | "tasks" | "global";

const HEARTBEAT_MS = 20_000; // send presence every 20s
const STALE_MS     = 60_000; // keep users for 60s of silence (fixes 5s drop)

export function useBoardPresence(
  boardKey: string | null | undefined,
  me: PresenceUser | null | undefined,
  scope: PresenceScope = "global"
) {
  // ✅ single shared channel per board (no page suffix)
  const channelName = useMemo(() => (boardKey ? `presence:${boardKey}` : null), [boardKey]);

  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const stateRef = useRef<Map<string, PresenceUser>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!channelName || !me?.email) return;

    const ch = supabase.channel(channelName, { config: { presence: { key: me.email } } });
    channelRef.current = ch;

    const refresh = () => {
      const now = Date.now();
      const list = Array.from(stateRef.current.values()).filter((u) => {
        const t = u.online_at ? new Date(u.online_at).getTime() : 0;
        return now - t < STALE_MS;
      });
      // newest first
      list.sort((a, b) => {
        const ta = a.online_at ? new Date(a.online_at).getTime() : 0;
        const tb = b.online_at ? new Date(b.online_at).getTime() : 0;
        return tb - ta;
      });
      setOnlineUsers(list);
    };

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, any[]>;
      stateRef.current.clear();
      Object.entries(state).forEach(([email, metas]) => {
        const last = metas[metas.length - 1]?.metas?.[0] ?? metas[metas.length - 1] ?? {};
        stateRef.current.set(email, {
          email,
          name: last.name || email.split("@")[0],
          avatar_url: last.avatar_url || null,
          online_at: last.online_at || new Date().toISOString(),
        });
      });
      refresh();
    })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        const meta = newPresences[newPresences.length - 1]?.metas?.[0] ?? newPresences[newPresences.length - 1] ?? {};
        stateRef.current.set(key, {
          email: key,
          name: meta.name || key.split("@")[0],
          avatar_url: meta.avatar_url || null,
          online_at: meta.online_at || new Date().toISOString(),
        });
        refresh();
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        // Don't instantly drop (fixes the "disappear after 5s" bug on public boards)
        const existed = stateRef.current.get(key);
        if (existed) {
          stateRef.current.set(key, { ...existed, online_at: new Date(Date.now() - STALE_MS - 1).toISOString() });
        }
        refresh();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({
            email: me.email,
            name: me.name,
            avatar_url: me.avatar_url,
            scope,
            online_at: new Date().toISOString(),
          });
        }
      });

    const heartbeat = setInterval(() => {
      ch.track({
        email: me.email,
        name: me.name,
        avatar_url: me.avatar_url,
        scope,
        online_at: new Date().toISOString(),
      }).catch(() => {});
      refresh();
    }, HEARTBEAT_MS);

    const slowRefresh = setInterval(refresh, 5000);

    return () => {
      clearInterval(heartbeat);
      clearInterval(slowRefresh);
      try { ch.untrack(); } catch {}
      supabase.removeChannel(ch);
    };
  }, [channelName, me?.email, me?.name, me?.avatar_url, scope]);

  // Instant avatar update: when avatar_url changes, immediately re-track presence
  useEffect(() => {
    if (!channelRef.current || !me?.email) return;
    
    channelRef.current.track({
      email: me.email,
      name: me.name,
      avatar_url: me.avatar_url,
      scope,
      online_at: new Date().toISOString(),
    }).catch(() => {});
  }, [me?.avatar_url]);

  return { onlineUsers };
}
