import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { resolveAvatarUrl } from './_avatar';
import { useToast } from '@/hooks/use-toast';

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  sender_name?: string;
  sender_avatar_url?: string;
  channel_id: string;
};

export const ChatArea = () => {
  const { me, currentChannelId, boardOwnerId } = useChat();
  const { toast } = useToast();
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [channelInfo, setChannelInfo] = useState<{ 
    name: string; 
    isDM: boolean; 
    dmPartner?: { name: string; avatar?: string } 
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Get or create default channel
  useEffect(() => {
    let active = true;
    
    (async () => {
      if (!boardOwnerId) return;

      // Find default channel
      const { data: ch } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('owner_id', boardOwnerId)
        .eq('is_default', true)
        .maybeSingle();

      if (ch && active) {
        setDefaultChannelId(ch.id);
        return;
      }

      // Create default channel if missing
      const { data: created } = await supabase
        .from('chat_channels')
        .insert({ 
          owner_id: boardOwnerId, 
          name: 'General', 
          emoji: '💬',
          is_default: true 
        })
        .select('id')
        .single();

      if (created && active) {
        setDefaultChannelId(created.id);
      }
    })();
    
    return () => { active = false; };
  }, [boardOwnerId]);

  // Active channel ID (context takes precedence)
  const activeChannelId = currentChannelId || defaultChannelId;

  // Load channel info
  useEffect(() => {
    let active = true;
    
    (async () => {
      if (!activeChannelId) {
        if (active) setChannelInfo(null);
        return;
      }
      
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('name, is_dm, participants')
        .eq('id', activeChannelId)
        .maybeSingle();
      
      if (!active || !channel) return;
      
      if (channel.is_dm && channel.participants) {
        const participants = channel.participants as string[];
        const otherParticipant = participants.find(pid => pid !== me?.id);
        
        if (otherParticipant) {
          // Try admin first
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', otherParticipant)
            .maybeSingle();
          
          if (profile && active) {
            setChannelInfo({
              name: channel.name,
              isDM: true,
              dmPartner: { name: profile.username || 'Admin', avatar: profile.avatar_url }
            });
            return;
          }

          // Try sub-user
          const { data: subUser } = await supabase
            .from('sub_users')
            .select('fullname, avatar_url')
            .eq('id', otherParticipant)
            .maybeSingle();
          
          if (subUser && active) {
            setChannelInfo({
              name: channel.name,
              isDM: true,
              dmPartner: { name: subUser.fullname || 'Member', avatar: subUser.avatar_url }
            });
          }
        }
      } else if (active) {
        setChannelInfo({ name: channel.name, isDM: false });
      }
    })();
    
    return () => { active = false; };
  }, [activeChannelId, me]);

  // Load messages
  useEffect(() => {
    let active = true;
    
    (async () => {
      if (!activeChannelId) return;
      
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', activeChannelId)
        .order('created_at', { ascending: true });

      if (active && data) {
        setMessages(data as Message[]);
      }
    })();
    
    return () => { active = false; };
  }, [activeChannelId]);

  // Real-time updates
  useEffect(() => {
    if (!activeChannelId) return;

    const ch = supabase
      .channel(`messages:${activeChannelId}`)
      .on('postgres_changes',
        { 
          schema: 'public', 
          table: 'chat_messages', 
          event: '*', 
          filter: `channel_id=eq.${activeChannelId}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new as Message]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => 
              m.id === (payload.new as any).id ? payload.new as Message : m
            ));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeChannelId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Send message
  const send = async () => {
    if (!draft.trim() || !activeChannelId || !me || !boardOwnerId) return;
    
    setSending(true);
    
    try {
      let senderUserId = null;
      let senderSubUserId = null;
      
      if (me.type === 'admin') {
        senderUserId = me.id;
      } else {
        senderSubUserId = me.id;
      }
      
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          content: draft.trim(),
          channel_id: activeChannelId,
          sender_user_id: senderUserId,
          sender_sub_user_id: senderSubUserId,
          sender_type: me.type,
          sender_name: me.name,
          sender_avatar_url: me.avatarUrl || null,
          owner_id: boardOwnerId
        });
      
      if (error) throw error;
      
      setDraft('');
      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="grid grid-rows-[auto,1fr,auto] h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
        {channelInfo?.isDM && channelInfo.dmPartner ? (
          <>
            <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center">
              {resolveAvatarUrl(channelInfo.dmPartner.avatar) ? (
                <img
                  src={resolveAvatarUrl(channelInfo.dmPartner.avatar)!}
                  alt={channelInfo.dmPartner.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium">
                  {(channelInfo.dmPartner.name || "U").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="font-semibold">{channelInfo.dmPartner.name}</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">
              Direct Message
            </span>
          </>
        ) : (
          <>
            <MessageCircle className="h-5 w-5" />
            <h2 className="font-semibold">{channelInfo?.name || 'General'}</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
              Channel
            </span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                {channelInfo?.isDM 
                  ? `Start a conversation with ${channelInfo.dmPartner?.name || 'this user'}!`
                  : `Welcome to #${channelInfo?.name || 'general'}. Start chatting with your team!`
                }
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {resolveAvatarUrl(message.sender_avatar_url) ? (
                      <img 
                        src={resolveAvatarUrl(message.sender_avatar_url)!} 
                        alt={message.sender_name || "User"} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium">
                        {(message.sender_name || "U").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {message.sender_name || "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none min-h-[36px] max-h-32"
            rows={1}
            disabled={sending}
          />
          <Button 
            onClick={send} 
            disabled={!draft.trim() || sending}
            size="sm"
            className="px-3 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};