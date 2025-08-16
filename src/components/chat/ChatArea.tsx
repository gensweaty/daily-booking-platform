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
  channel_id: string;
};

export const ChatArea = () => {
  const { user } = useAuth();
  const { me } = useChat();
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

  // 2) load messages
  useEffect(() => {
    let active = true;
    (async () => {
      if (!channelId) return;
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, created_at, sender_user_id, sender_type, channel_id')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (active && data) setMessages(data as Message[]);
    })();
    return () => { active = false; };
  }, [channelId]);

  // 3) realtime subscription
  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`chat:${channelId}`)
      .on('postgres_changes',
        { schema: 'public', table: 'chat_messages', event: 'INSERT', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [channelId]);

  // 4) auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // 5) send message
  const send = async () => {
    if (!draft.trim() || !channelId || !me?.id) return;
    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        content: draft.trim(),
        channel_id: channelId,
        sender_user_id: me.id,
        sender_type: me.type,
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
      <ScrollArea className="flex-1">
        <div className="p-3 md:p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Welcome to <b>#general</b>. Start a conversation with your team!
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                <div className="text-xs text-muted-foreground">
                  {m.sender_type === 'admin' ? 'Admin' : 'Member'} • {new Date(m.created_at).toLocaleTimeString()}
                </div>
                <div className="text-sm leading-normal whitespace-pre-wrap break-words">{m.content}</div>
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