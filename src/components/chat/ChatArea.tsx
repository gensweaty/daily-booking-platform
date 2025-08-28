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
      if (!boardOwnerId) {
        console.log('❌ No boardOwnerId for default channel setup');
        return;
      }

      console.log('🔍 Setting up default channel for board owner:', boardOwnerId);

      try {
        // Find default channel with participants
        const { data: channelsWithParticipants, error } = await supabase
          .from('chat_channels')
          .select(`
            id, 
            name,
            created_at,
            chat_participants(id)
          `)
          .eq('owner_id', boardOwnerId)
          .eq('is_default', true)
          .eq('name', 'General')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('❌ Error loading default channels:', error);
          return;
        }

        if (channelsWithParticipants && channelsWithParticipants.length > 0) {
          // Sort by participant count, prefer channels with participants
          const sortedChannels = channelsWithParticipants.sort((a, b) => {
            const aParticipants = (a.chat_participants as any[])?.length || 0;
            const bParticipants = (b.chat_participants as any[])?.length || 0;
            
            if (aParticipants !== bParticipants) {
              return bParticipants - aParticipants; // More participants first
            }
            
            // If same participant count, prefer older channel
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });

          const selectedChannel = sortedChannels[0];
          const participantCount = (selectedChannel.chat_participants as any[])?.length || 0;

          console.log('✅ Default channel selected:', { 
            id: selectedChannel.id,
            participantCount,
            createdAt: selectedChannel.created_at 
          });

          if (active) {
            setDefaultChannelId(selectedChannel.id);
          }
          return;
        }

        console.log('⚠️ No default General channels found - this should not happen after cleanup');
        
      } catch (error) {
        console.error('❌ Error setting up default channel:', error);
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
        const isPublicBoard = location.pathname.startsWith('/board/');
        
        if (isPublicBoard && boardOwnerId) {
          console.log('🔍 Using service function for public board messages');
          const { data, error } = await supabase.rpc('get_chat_messages_for_channel', {
            p_channel_id: activeChannelId,
            p_board_owner_id: boardOwnerId
          });

          console.log('📨 Service function messages result:', { 
            messageCount: data?.length || 0, 
            error: error?.message,
            firstMessage: data?.[0],
            channelId: activeChannelId
          });

          if (error) {
            console.error('❌ Error loading messages via service function:', error);
            return;
          }

          if (active && data) {
            console.log('✅ Messages loaded via service function:', data.length, 'messages');
            setMessages(data as Message[]);
          }
          return;
        }
        
        // Fallback to regular query for authenticated users
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('channel_id', activeChannelId)
          .order('created_at', { ascending: true });

        console.log('📨 Regular query messages result:', { 
          messageCount: data?.length || 0, 
          error: error?.message,
          firstMessage: data?.[0],
          channelId: activeChannelId
        });

        if (error) {
          console.error('❌ Error loading messages:', error);
          return;
        }

        if (active && data) {
          console.log('✅ Messages loaded:', data.length, 'messages');
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
      
      if (isPublicBoard && me?.type === 'sub_user') {
        // Get stored email from the same place used during PublicBoard login
        const slug = location.pathname.split('/').pop()!;
        const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        const senderEmail = stored?.email;
        if (!senderEmail) throw new Error('Missing sub-user email for public board');

        const { error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: senderEmail,
          p_content: draft.trim(),
        });
        if (error) throw error;
      } else {
        // Dashboard / authenticated
        let senderUserId: string | null = null;
        let senderSubUserId: string | null = null;
        if (me?.type === 'admin') senderUserId = me.id;
        if (me?.type === 'sub_user') senderSubUserId = me.id;

        const { error } = await supabase.from('chat_messages').insert({
          content: draft.trim(),
          channel_id: activeChannelId,
          sender_user_id: senderUserId,
          sender_sub_user_id: senderSubUserId,
          sender_type: me?.type,
          sender_name: me?.name,
          sender_avatar_url: me?.avatarUrl || null,
          owner_id: boardOwnerId,
        });
        if (error) throw error;
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