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
  const { me, currentChannelId, boardOwnerId, isInitialized } = useChat();
  const { toast } = useToast();
  const location = useLocation();
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
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

  // Load messages for the active channel - ENHANCED with loading states
  useEffect(() => {
    let active = true;

    const loadMessages = async () => {
      if (!activeChannelId || !me || !boardOwnerId || !isInitialized) {
        console.log('⏭️ Skipping message load - missing requirements:', {
          activeChannelId: !!activeChannelId,
          me: !!me,
          boardOwnerId: !!boardOwnerId,
          isInitialized
        });
        return;
      }

      try {
        setLoading(true);
        setMessages([]);
        
        // FIXED: Check if this is an authenticated user from dashboard context
        const { data: { session } } = await supabase.auth.getSession();
        const isAuthenticatedUser = !!session?.user?.id;
        
        console.log('🔍 Loading messages:', {
          activeChannelId,
          boardOwnerId,
          me: me?.email,
          myId: me?.id,
          myType: me?.type,
          isAuthenticatedUser,
          route: location.pathname
        });
        
        if (isAuthenticatedUser) {
          // AUTHENTICATED USER: Use regular RPC (works for both admin and sub-users)
          console.log('📨 Loading messages for authenticated user via get_chat_messages_for_channel');
          const { data, error } = await supabase
            .rpc('get_chat_messages_for_channel', {
              p_board_owner_id: boardOwnerId,
              p_channel_id: activeChannelId,
            });

          if (error) {
            console.error('❌ Error loading authenticated messages:', error);
            if (active) setLoading(false);
            return;
          }

          if (active) {
            console.log('✅ Loaded', data?.length || 0, 'messages for authenticated user');
            setMessages((data || []).map(msg => ({
              ...msg,
              sender_type: msg.sender_type as 'admin' | 'sub_user'
            })));
            setLoading(false);
          }
        } else {
          // PUBLIC BOARD ACCESS: Use secure RPC function
          console.log('📨 Loading messages for public board access via list_channel_messages_public');
          const slug = location.pathname.split('/').pop();
          const accessData = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
          
          const { data, error } = await supabase.rpc('list_channel_messages_public', {
            p_owner_id: boardOwnerId,
            p_channel_id: activeChannelId,
            p_requester_type: 'sub_user',
            p_requester_email: accessData.email || me.email,
          });

          if (error) {
            console.error('❌ Error loading public messages:', error);
            if (active) setLoading(false);
            return;
          }

          if (active) {
            console.log('✅ Loaded', data?.length || 0, 'messages for public board access');
            setMessages((data || []).map(msg => ({
              ...msg,
              sender_type: msg.sender_type as 'admin' | 'sub_user'
            })));
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('❌ Error in loadMessages:', error);
        if (active) setLoading(false);
      }
    };

    loadMessages();

    return () => {
      active = false;
    };
  }, [activeChannelId, boardOwnerId, me?.id, me?.email, location.pathname, isInitialized]);

  // Clear messages when channel changes to avoid ghost messages
  useEffect(() => { 
    setMessages([]); 
  }, [activeChannelId]);

  // Polling for non-authenticated users only (authenticated users use real-time)
  useEffect(() => {
    if (!activeChannelId || !boardOwnerId || !me) return;

    let mounted = true;
    
    // Check authentication status
    const checkAndPoll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticatedUser = !!session?.user?.id;
      
      // Only poll for non-authenticated public board access
      if (isAuthenticatedUser) {
        console.log('⏭️ Skipping polling - authenticated user uses real-time');
        return;
      }
      
      console.log('📊 Starting polling for public board access');
      
      const poll = async () => {
        const slug = location.pathname.split('/').pop();
        const accessData = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        
        const { data } = await supabase.rpc('list_channel_messages_public', {
          p_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_requester_type: 'sub_user',
          p_requester_email: accessData.email || me.email,
        });
        
        if (!mounted || !data) return;
        
        setMessages(prev => {
          const byId = new Map(prev.map(m => [m.id, m]));
          for (const m of data) {
            byId.set(m.id, {
              ...m,
              sender_type: m.sender_type as 'admin' | 'sub_user'
            });
          }
          return Array.from(byId.values()).sort((a,b) => +new Date(a.created_at) - +new Date(b.created_at));
        });
      };

      const intervalId = setInterval(poll, 2500);
      poll(); // immediate poll
      
      return () => { 
        clearInterval(intervalId); 
      };
    };
    
    checkAndPoll();
    
    return () => { 
      mounted = false; 
    };
  }, [activeChannelId, boardOwnerId, me?.email, location.pathname]);

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
      // ENHANCED: Determine sending context with better sub-user handling
      const isOnPublicBoard = location.pathname.startsWith('/board/');
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticatedUser = !!session?.user?.id;
      
      console.log('📤 Sending message context:', {
        isOnPublicBoard,
        isAuthenticatedUser,
        meType: me?.type,
        meId: me?.id,
        meEmail: me?.email,
        boardOwnerId
      });
      
      // PRIORITY 1: Sub-user on public board (authenticated or not)
      if (me?.type === 'sub_user') {
        console.log('📤 PRIORITY: Sending message as sub-user');
        const senderEmail = me.email;
        if (!senderEmail) throw new Error('Missing sub-user email');

        const { error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: senderEmail,
          p_content: draft.trim(),
        });
        if (error) throw error;
        
        console.log('✅ Sub-user message sent successfully via public board RPC');
      } else if (isAuthenticatedUser && me?.type === 'admin') {
        // PRIORITY 2: Authenticated admin user
        console.log('📤 Sending message as authenticated admin');
        const { error } = await supabase.rpc('send_authenticated_message', {
          p_channel_id: activeChannelId,
          p_owner_id: boardOwnerId,
          p_content: draft.trim(),
        });
        if (error) throw error;
        
        console.log('✅ Authenticated admin message sent via RPC');
      } else {
        // FALLBACK: Public board access
        console.log('📤 Fallback: Sending message as public board access');
        const slug = location.pathname.split('/').pop()!;
        const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        const senderEmail = me?.email || stored?.email;
        if (!senderEmail) throw new Error('Missing sender email for public board');

        const { error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: senderEmail,
          p_content: draft.trim(),
        });
        if (error) throw error;
        
        console.log('✅ Public board message sent via RPC');
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

  // Enhanced loading state with timeout fallback
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  useEffect(() => {
    if (loading || !isInitialized) {
      const timeoutId = setTimeout(() => {
        console.log('⚠️ ChatArea: Loading timeout reached, forcing display');
        setLoadingTimeout(true);
      }, 6000);
      
      return () => clearTimeout(timeoutId);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading, isInitialized]);

  // Show loading state while authentication and data are resolving
  if (!loadingTimeout && (loading || !isInitialized)) {
    return (
      <div className="grid grid-rows-[auto,1fr,auto] h-full overflow-hidden bg-background">
        <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
          <MessageCircle className="h-5 w-5 animate-pulse" />
          <h2 className="font-semibold">Loading...</h2>
        </div>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading chat...</p>
            <p className="text-xs text-muted-foreground">Initializing chat system...</p>
            {/* Add timeout hint to prevent confusion about infinite loading */}
            <p className="text-xs text-muted-foreground/70 mt-2">
              If this takes too long, try refreshing the page
            </p>
          </div>
        </div>
        <div className="p-4 border-t bg-muted/30">
          <div className="bg-muted rounded-md h-10 animate-pulse"></div>
        </div>
      </div>
    );
  }

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