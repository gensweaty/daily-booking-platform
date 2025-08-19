import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';

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

  // 3) realtime subscription with full event handling
  useEffect(() => {
    if (!activeChannelId) return;

    const ch = supabase
      .channel(`chat:${activeChannelId}`)
      .on(
        'postgres_changes',
        { schema: 'public', table: 'chat_messages', event: '*', filter: `channel_id=eq.${activeChannelId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new as Message]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as Message : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
          }
        }
      );

    // Subscribe and handle the promise separately
    ch.subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
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
            messages.map((m) => (
              <div key={m.id} className="flex gap-2 py-2">
                <div className="relative h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                  {m.sender_avatar_url && m.sender_avatar_url.trim() && !m.sender_avatar_url.includes('null') ? (
                    <img 
                      src={m.sender_avatar_url.startsWith('http') ? m.sender_avatar_url : `https://mrueqpffzauvdxmuwhfa.supabase.co/storage/v1/object/public/avatars/${m.sender_avatar_url}`}
                      className="h-full w-full object-cover" 
                      alt=""
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.initials-fallback')) {
                          const span = document.createElement('span');
                          span.className = 'text-xs font-medium initials-fallback text-foreground';
                          span.textContent = (m.sender_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                          parent.appendChild(span);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-xs font-medium text-foreground initials-fallback">
                      {(m.sender_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
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
            ))
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