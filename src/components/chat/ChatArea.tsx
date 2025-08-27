import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { resolveAvatarUrl } from './_avatar';

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
  const [channelInfo, setChannelInfo] = useState<{ name: string; isDM: boolean; dmPartner?: { name: string; avatar?: string } } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Ensure default channel exists and get its id
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) return;

      // Find or create the owner's default "general" channel
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

      // Create if missing
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

  // Load channel info for dynamic header
  useEffect(() => {
    let active = true;
    (async () => {
      if (!activeChannelId) {
        if (active) setChannelInfo(null);
        return;
      }
      
      console.log('🔍 Loading channel info for:', activeChannelId);
      
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('name, is_dm, participants')
        .eq('id', activeChannelId)
        .maybeSingle();
      
      if (!active || !channel) {
        console.log('❌ Channel not found:', activeChannelId);
        return;
      }
      
      console.log('📋 Channel data:', channel);
      
      if (channel.is_dm && channel.participants) {
        // Find the other participant for DM
        const participants = channel.participants as any[];
        console.log('👥 DM participants:', participants);
        console.log('👤 Current me:', me);
        
        // Look for other participant (not current user)
        const otherParticipant = participants.find(participantId => {
          // participants array contains just user IDs, not objects
          if (typeof participantId === 'string') {
            return participantId !== me?.id;
          }
          return false;
        });
        
        console.log('🎯 Other participant ID:', otherParticipant);
        
        if (otherParticipant) {
          // Get participant details - try both admin and sub-user
          let partnerInfo = { name: 'Unknown', avatar: null };
          
          // Try as admin first
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', otherParticipant)
            .maybeSingle();
          
          if (profile) {
            console.log('✅ Found admin partner:', profile);
            partnerInfo = { name: profile.username || 'Admin', avatar: profile.avatar_url };
          } else {
            // Try as sub-user
            const { data: subUser } = await supabase
              .from('sub_users')
              .select('fullname, avatar_url')
              .eq('id', otherParticipant)
              .maybeSingle();
            
            if (subUser) {
              console.log('✅ Found sub-user partner:', subUser);
              partnerInfo = { name: subUser.fullname || 'Member', avatar: subUser.avatar_url };
            } else {
              console.log('❌ Partner not found in profiles or sub_users');
            }
          }
          
          if (active) {
            setChannelInfo({
              name: channel.name,
              isDM: true,
              dmPartner: partnerInfo
            });
          }
        } else {
          console.log('❌ No other participant found');
          if (active) {
            setChannelInfo({
              name: channel.name,
              isDM: true,
              dmPartner: { name: 'Unknown User', avatar: null }
            });
          }
        }
      } else {
        console.log('📢 Setting channel info for general channel:', channel.name);
        if (active) {
          setChannelInfo({
            name: channel.name,
            isDM: false
          });
        }
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
        .select('id, content, created_at, sender_user_id, sender_type, sender_name, sender_avatar_url, channel_id')
        .eq('channel_id', activeChannelId)
        .order('created_at', { ascending: true });

      if (active && data) {
        setMessages(data as Message[]);
      }
    })();
    return () => { active = false; };
  }, [activeChannelId]);

  // Real-time subscription
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
            setMessages(prev => prev.map(m => m.id === (payload.new as any).id ? payload.new as Message : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [activeChannelId]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Send message
  const send = async () => {
    if (!draft.trim() || !activeChannelId || !me?.id) return;
    setSending(true);
    try {
      // Determine board owner for this message
      let ownerId: string | null = null;
      if (me.type === 'admin') {
        ownerId = me.id;
      } else {
        const { data: su } = await supabase
          .from('sub_users')
          .select('board_owner_id')
          .eq('id', me.id)
          .maybeSingle();
        ownerId = su?.board_owner_id || null;
      }
      
      await supabase.from('chat_messages').insert({
        content: draft.trim(),
        channel_id: activeChannelId,
        sender_user_id: me.id,
        sender_type: me.type,
        sender_name: me.name,
        sender_avatar_url: me.avatarUrl || null,
        owner_id: ownerId
      });
      setDraft('');
    } catch (error) {
      console.error('Failed to send message:', error);
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
    <div className="grid grid-rows-[auto,1fr,auto] h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30 min-h-[60px]">
        <div className="flex items-center gap-2">
          {channelInfo?.isDM && channelInfo.dmPartner ? (
            <>
              <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {resolveAvatarUrl(channelInfo.dmPartner.avatar) ? (
                  <img
                    src={resolveAvatarUrl(channelInfo.dmPartner.avatar)!}
                    alt={channelInfo.dmPartner.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.initials-fallback')) {
                        const initials = document.createElement('span');
                        initials.className = 'text-xs font-medium text-foreground initials-fallback';
                        initials.textContent = (channelInfo.dmPartner?.name || "U")
                          .split(" ")
                          .map(w => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2);
                        parent.appendChild(initials);
                      }
                    }}
                  />
                ) : (
                  <span className="text-xs font-medium text-foreground">
                    {(channelInfo.dmPartner.name || "U")
                      .split(" ")
                      .map(w => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
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
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">{channelInfo?.name || 'General'}</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
                {channelInfo?.name === 'general' ? 'Default' : 'Channel'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">
                  {channelInfo?.isDM 
                    ? `Start a conversation with ${channelInfo.dmPartner?.name || 'this user'}!`
                    : `Welcome to <b>#${channelInfo?.name || 'general'}</b>. Start a conversation with your team!`
                  }
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                        {resolveAvatarUrl(message.sender_avatar_url) ? (
                          <img 
                            src={resolveAvatarUrl(message.sender_avatar_url)!} 
                            alt={message.sender_name || "User"} 
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('.initials-fallback')) {
                                const initials = document.createElement('span');
                                initials.className = 'text-xs font-medium text-foreground initials-fallback';
                                initials.textContent = (message.sender_name || "U")
                                  .split(" ")
                                  .map(w => w[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2);
                                parent.appendChild(initials);
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xs font-medium text-foreground">
                            {(message.sender_name || "U")
                              .split(" ")
                              .map(w => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {message.sender_name || "Unknown User"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Message Input */}
      <div className="p-4 border-t min-h-[80px] bg-background">
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