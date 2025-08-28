import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();
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

  // Get or create default channel with better error handling
  useEffect(() => {
    let active = true;

    (async () => {
      if (!boardOwnerId) return;

      const isPublicBoard = location.pathname.startsWith('/board/');

      try {
        if (isPublicBoard) {
          // ✅ RLS-safe path for public boards
          const { data, error } = await supabase.rpc('get_default_channel_for_board', {
            p_board_owner_id: boardOwnerId,
          });

          if (error) {
            console.error('❌ get_default_channel_for_board:', error);
            return;
          }
          if (data && data.length > 0) {
            const ch = data[0];
            if (active) setDefaultChannelId(ch.id as string);
            return;
          }
          console.warn('⚠️ No default channel via RPC');
          return;
        }

        // ✅ Dashboard / authenticated fallback
        const { data: channelsWithParticipants, error } = await supabase
          .from('chat_channels')
          .select(`id, name, created_at, chat_participants(id)`)
          .eq('owner_id', boardOwnerId)
          .eq('is_default', true)
          .eq('name', 'General')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('❌ Error loading default channels:', error);
          return;
        }

        if (channelsWithParticipants?.length) {
          const sorted = channelsWithParticipants.sort((a: any, b: any) => {
            const ac = (a.chat_participants as any[])?.length || 0;
            const bc = (b.chat_participants as any[])?.length || 0;
            return ac !== bc
              ? bc - ac
              : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          if (active) setDefaultChannelId(sorted[0].id);
        } else {
          console.warn('⚠️ No default General channels found');
        }
      } catch (e) {
        console.error('❌ Error setting up default channel:', e);
      }
    })();

    return () => { active = false; };
  }, [boardOwnerId, location.pathname]);

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
      
      const isPublicBoard = location.pathname.startsWith('/board/');
      
      // Use new approach: get channel info without participants JSON
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id, name, is_dm')
        .eq('id', activeChannelId)
        .maybeSingle();
      
      if (!active || !channel) return;
      
      if (channel.is_dm) {
        if (isPublicBoard) {
          // RLS-safe fallback header in public view
          setChannelInfo({ name: channel.name, isDM: true });
          return;
        }
        
        // get both participants from chat_participants
        const { data: cps, error: cpErr } = await supabase
          .from('chat_participants')
          .select('user_id, sub_user_id, user_type')
          .eq('channel_id', channel.id);

        if (cpErr || !cps) {
          setChannelInfo({ name: channel.name, isDM: true });
          return;
        }

        // identify "me" vs "other"
        const amAdmin = me?.type === 'admin';
        const myId = me?.id;

        const other = cps.find(p => {
          if (amAdmin) return p.user_id && p.user_id !== myId;
          return p.sub_user_id && p.sub_user_id !== myId;
        }) || cps.find(p => (amAdmin ? p.sub_user_id : p.user_id)); // fallback

        if (!other) {
          setChannelInfo({ name: channel.name, isDM: true });
          return;
        }

        if (other.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', other.user_id)
            .maybeSingle();
          setChannelInfo({
            name: channel.name,
            isDM: true,
            dmPartner: { name: profile?.username || 'Admin', avatar: profile?.avatar_url }
          });
        } else if (other.sub_user_id) {
          const { data: su } = await supabase
            .from('sub_users')
            .select('fullname, avatar_url')
            .eq('id', other.sub_user_id)
            .maybeSingle();
          setChannelInfo({
            name: channel.name,
            isDM: true,
            dmPartner: { name: su?.fullname || 'Member', avatar: su?.avatar_url || undefined }
          });
        } else {
          setChannelInfo({ name: channel.name, isDM: true });
        }
      } else {
        setChannelInfo({ name: channel.name, isDM: false });
      }
    })();
    
    return () => { active = false; };
  }, [activeChannelId, me, location.pathname]);

  // Load messages with enhanced error handling
  useEffect(() => {
    let active = true;
    
    (async () => {
      if (!activeChannelId) {
        console.log('❌ No activeChannelId for loading messages');
        if (active) setMessages([]);
        return;
      }
      
      console.log('📨 Loading messages for channel:', activeChannelId);
      
      const authResult = await supabase.auth.getUser();
      console.log('🔍 Current user context for messages:', { 
        me, 
        boardOwnerId,
        authUser: authResult.data.user?.id || 'NO_AUTH_USER',
        authUserEmail: authResult.data.user?.email || 'NO_AUTH_EMAIL',
        hasAuthError: !!authResult.error
      });
      
      try {
        // Use RPC for all message loading (both board + dashboard)
        const { data, error } = await supabase.rpc('get_chat_messages_for_channel', {
          p_channel_id: activeChannelId,
          p_board_owner_id: boardOwnerId
        });

        console.log('📨 RPC messages result:', { 
          messageCount: data?.length || 0, 
          error: error?.message,
          firstMessage: data?.[0],
          channelId: activeChannelId
        });

        if (error) {
          console.error('❌ Error loading messages via RPC:', error);
          return;
        }

        if (active && data) {
          console.log('✅ Messages loaded via RPC:', data.length, 'messages');
          setMessages(data as Message[]);
        }
      } catch (error) {
        console.error('❌ Unexpected error loading messages:', error);
        if (active) setMessages([]);
      }
    })();
    
    return () => { active = false; };
  }, [activeChannelId, location.pathname]);

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

  const send = async () => {
    if (!draft.trim() || !activeChannelId || !boardOwnerId) {
      return;
    }
    
    setSending(true);
    
    try {
      const isPublicBoard = location.pathname.startsWith('/board/');
      
      if (isPublicBoard) {
        const slug = location.pathname.split('/').pop()!;
        const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        const senderEmail = me?.email || stored?.email;
        if (!senderEmail) throw new Error('Missing sub-user email for public board');

        const { data, error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: senderEmail,
          p_content: draft.trim(),
        });
        if (error) throw error;

        // immediate echo
        if (data) setMessages(prev => [...prev, data as Message]);
      } else {
        // dashboard (owner) - use RPC
        const { data, error } = await supabase.rpc('send_authenticated_message', {
          p_channel_id: activeChannelId,
          p_owner_id: boardOwnerId,
          p_content: draft.trim(),
        });
        if (error) throw error;

        if (data) setMessages(prev => [...prev, data as Message]);
      }
      
      setDraft('');
    } catch (e: any) {
      toast({ 
        title: 'Error', 
        description: e.message || 'Failed to send', 
        variant: 'destructive' 
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