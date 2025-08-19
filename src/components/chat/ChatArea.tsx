import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { resolveAvatarUrl, initials } from './avatar';

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_user_id: string;
  sender_type: 'admin' | 'sub_user';
  sender_name?: string;
  sender_avatar_url?: string;
  channel_id: string;
};

export const ChatArea = () => {
  const { user } = useAuth();
  const { me, currentChannelId } = useChat();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 1) ensure default channel exists and get its id
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) return;

      // find or create the owner's default "general" channel
      const { data: ch, error } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      if (!error && ch) {
        active && setChannelId(ch.id);
        return;
      }

      // create if missing
      const { data: created, error: insErr } = await supabase
        .from('chat_channels')
        .insert({ owner_id: user.id, name: 'general', is_default: true })
        .select('id')
        .single();

      if (!insErr && created && active) setChannelId(created.id);
    })();
    return () => { active = false; };
  }, [user?.id]);

  // Use currentChannelId from context if set, otherwise default channel
  const activeChannelId = currentChannelId || channelId;

  // 2) load messages
  useEffect(() => {
    let active = true;
    (async () => {
      if (!activeChannelId) return;
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, created_at, sender_user_id, sender_type, sender_name, sender_avatar_url, channel_id')
        .eq('channel_id', activeChannelId)
        .order('created_at', { ascending: true });

      if (active && data) setMessages(data as Message[]);
    })();
    return () => { active = false; };
  }, [activeChannelId]);

  // 3) realtime subscription with connection status + fallback polling
  useEffect(() => {
    if (!activeChannelId) return;

    let cancelled = false;

    // 3a) Subscribe to Realtime changes
    const channel = supabase
      .channel(`chat:${activeChannelId}`, { config: { broadcast: { ack: true } } })
      .on(
        'postgres_changes',
        { schema: 'public', table: 'chat_messages', event: '*', filter: `channel_id=eq.${activeChannelId}` },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new as Message]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === (payload.new as any).id ? (payload.new as Message) : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
          }
        }
      );

    channel.subscribe((status) => {
      console.log('📡 chat realtime status', status);
    });

    // 3b) Fallback polling if Realtime is blocked by network/proxy
    let pollTimer: any = null;
    const startPoll = () => {
      stopPoll();
      pollTimer = setInterval(async () => {
        if (!activeChannelId) return;
        const last = messages[messages.length - 1]?.created_at;
        const q = supabase
          .from('chat_messages')
          .select('id, content, created_at, sender_user_id, sender_type, sender_name, sender_avatar_url, channel_id')
          .eq('channel_id', activeChannelId)
          .order('created_at', { ascending: true });
        const { data } = last ? await q.gt('created_at', last) : await q;
        if (data?.length) setMessages(prev => [...prev, ...(data as Message[])]);
      }, 3500);
    };
    const stopPoll = () => pollTimer && clearInterval(pollTimer);

    // Start a short poll as safety net
    startPoll();

    return () => {
      cancelled = true;
      stopPoll();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  // 4) auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // 5) send message
  const send = async () => {
    if (!draft.trim() || !activeChannelId || !me?.id) return;
    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        content: draft.trim(),
        channel_id: activeChannelId,
        sender_user_id: me.id,
        sender_type: me.type,
        sender_name: me.name,
        sender_avatar_url: me.avatarUrl || null
      });
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-border bg-background/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h2 className="font-semibold truncate">general</h2>
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Default</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-3 md:p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Welcome to <b>#general</b>. Start a conversation with your team!
            </div>
          ) : (
            messages.map((m) => {
              const url = resolveAvatarUrl(m.sender_avatar_url);
              return (
              <div key={m.id} className="flex gap-2 py-2">
                <div className="relative h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                  {url ? (
                    <img
                      src={url}
                      className="h-full w-full object-cover"
                      alt=""
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent && !parent.querySelector(".initials-fallback")) {
                          const span = document.createElement("span");
                          span.className = "text-xs font-medium initials-fallback text-foreground";
                          span.textContent = initials(m.sender_name);
                          parent.appendChild(span);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-xs font-medium text-foreground initials-fallback">
                      {initials(m.sender_name)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {m.sender_name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm break-words">{m.content}</div>
                </div>
              </div>
            );})
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border bg-background/50 p-3 md:p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message #general"
            className="min-h-[42px] max-h-[40vh] resize-y"
          />
          <Button onClick={send} disabled={sending || !draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};