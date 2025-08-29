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
  
  // Message cache for instant channel switching
  const cacheRef = useRef<Map<string, Message[]>>(new Map());

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
      
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id, name, is_dm, chat_participants(user_id, sub_user_id, user_type)')
        .eq('id', activeChannelId)
        .maybeSingle();

      if (!active || !channel) return;

      const cps = (channel as any).chat_participants || [];
      const isDM = channel.is_dm || cps.length === 2;
      if (isDM) {
        // Find the OTHER participant (not me)
        console.log('🔍 Finding DM partner from participants:', { cps, me });
        const myId = me?.id;
        const myType = me?.type;
        
        const other = cps.find((p: any) => {
          // Skip if this is me
          if (myType === 'admin' && p.user_id === myId) return false;
          if (myType === 'sub_user' && p.sub_user_id === myId) return false;
          // Return the other participant
          return true;
        });

        console.log('🔍 Found DM partner participant:', other);

        if (other?.user_id) {
          // Use the new admin display helper function
          const { data: adminName } = await supabase
            .rpc('get_admin_display_name', { p_user_id: other.user_id });
          
          const { data: profile } = await supabase
            .from('profiles').select('avatar_url').eq('id', other.user_id).maybeSingle();
            
          console.log('✅ Admin DM partner resolved:', { displayName: adminName });
          setChannelInfo({ name: channel.name, isDM: true, dmPartner: { name: adminName || 'Admin', avatar: profile?.avatar_url } });
        } else if (other?.sub_user_id) {
          const { data: su } = await supabase
            .from('sub_users').select('fullname, avatar_url, email').eq('id', other.sub_user_id).maybeSingle();
          
          // Enhanced name resolution for sub-users
          const subUserName = su?.fullname || su?.email?.split('@')[0] || 'Member';
          
          console.log('✅ Sub-user DM partner resolved:', { fullname: su?.fullname, email: su?.email, displayName: subUserName });
          setChannelInfo({ name: channel.name, isDM: true, dmPartner: { name: subUserName, avatar: su?.avatar_url || undefined } });
        } else {
          console.log('❌ No valid DM partner found');
          setChannelInfo({ name: channel.name, isDM: true });
        }
      } else {
        setChannelInfo({ name: channel.name, isDM: false });
      }
    })();
    
    return () => { active = false; };
  }, [activeChannelId, me, location.pathname]);

  // Load messages with cache-first approach for instant switching
  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      return;
    }

    // Check cache first for instant display
    const cached = cacheRef.current.get(activeChannelId);
    if (cached) {
      console.log('⚡ Showing cached messages for channel:', activeChannelId, cached.length);
      setMessages(cached);
    } else {
      console.log('🔍 No cache found for channel:', activeChannelId);
      setMessages([]);
    }

    // Always fetch fresh data in background
    let active = true;
    (async () => {
      if (!me) return;
      
      console.log('📨 Background loading messages for channel:', activeChannelId);
      
      try {
        const isPublicBoard = location.pathname.startsWith('/board/');
        
        // C.6 Fix message loading for public boards 
        if (isPublicBoard) {
          const slug = location.pathname.split('/').pop()!;
          const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
          const requesterType = 'sub_user'; // on public page
          const requesterEmail = me?.email || stored?.email;

          if (!requesterEmail) {
            console.error('❌ Missing requester email for public board');
            return;
          }

          const { data, error } = await supabase.rpc('list_channel_messages_public', {
            p_owner_id: boardOwnerId,
            p_channel_id: activeChannelId,
            p_requester_type: requesterType,
            p_requester_email: requesterEmail,
          });

          if (error) {
            console.error('❌ Error loading public messages via RPC:', error);
            return;
          }

          if (active && data) {
            const freshMessages = data as Message[];
            console.log('✅ Public messages loaded via RPC:', freshMessages.length, 'messages');
            
            // Update cache
            cacheRef.current.set(activeChannelId, freshMessages);
            
            // Update UI if still on same channel
            setMessages(freshMessages);
          }
        } else {
          // Dashboard (authenticated) can keep the direct select
          const { data, error } = await supabase
            .from('chat_messages')
            .select('id, content, created_at, sender_user_id, sender_sub_user_id, sender_type, sender_name, sender_avatar_url, channel_id')
            .eq('channel_id', activeChannelId)
            .order('created_at', { ascending: true });

          if (error) {
            console.error('❌ Error loading dashboard messages:', error);
            return;
          }

          if (active && data) {
            const freshMessages = data as Message[];
            console.log('✅ Dashboard messages loaded:', freshMessages.length, 'messages');
            
            // Update cache
            cacheRef.current.set(activeChannelId, freshMessages);
            
            // Update UI if still on same channel
            setMessages(freshMessages);
          }
        }
      } catch (error) {
        console.error('❌ Unexpected error loading messages:', error);
      }
    })();
    
    return () => { active = false; };
  }, [activeChannelId, me]);

  // Listen for real-time messages with cache updates and strict deduplication
  useEffect(() => {
    const handleMessage = (event: CustomEvent) => {
      const { message } = event.detail as { message: Message };
      const channelId = message.channel_id;
      
      console.log('📨 Real-time message received for channel:', channelId);
      
      // Update cache for this channel
      const currentCache = cacheRef.current.get(channelId) || [];
      const existsInCache = currentCache.some(m => m.id === message.id);
      
      if (!existsInCache) {
        const updatedCache = [...currentCache, message];
        cacheRef.current.set(channelId, updatedCache);
        console.log('💾 Updated cache for channel:', channelId, 'total:', updatedCache.length);
        
        // Update UI if this is the active channel
        if (channelId === activeChannelId) {
          setMessages(prev => {
            const existsInUI = prev.some(m => m.id === message.id);
            if (existsInUI) {
              console.log('⏭️ Skipping duplicate in UI:', message.id);
              return prev;
            }
            return [...prev, message];
          });
        }
      } else {
        console.log('⏭️ Message already in cache:', message.id);
      }
    };

    window.addEventListener('chat-message-received', handleMessage as EventListener);
    return () => {
      window.removeEventListener('chat-message-received', handleMessage as EventListener);
    };
  }, [activeChannelId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    if (!draft.trim() || !activeChannelId || !boardOwnerId || !me) {
      return;
    }
    
    setSending(true);
    
    try {
      // For now, fallback to existing separate RPCs since send_chat_message doesn't exist yet
      const isPublicBoard = location.pathname.startsWith('/board/');
      
      if (isPublicBoard) {
        const slug = location.pathname.split('/').pop()!;
        const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        const senderEmail = me?.email || stored?.email;
        if (!senderEmail) throw new Error('Missing sub-user email for public board');

        const { error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: senderEmail,
          p_content: draft.trim(),
        });
        if (error) throw error;
        
        console.log('✅ Public board message sent via RPC');
      } else {
        // dashboard (owner) - use RPC
        const { error } = await supabase.rpc('send_authenticated_message', {
          p_channel_id: activeChannelId,
          p_owner_id: boardOwnerId,
          p_content: draft.trim(),
        });
        if (error) throw error;
        
        console.log('✅ Dashboard message sent via RPC');
      }
      
      // Clear draft after successful send
      setDraft('');
      
    } catch (e: any) {
      console.error('❌ Send error:', e);
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