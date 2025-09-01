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
import { cn } from '@/lib/utils';
import { MessageInput } from './MessageInput';
import { MessageAttachments } from './MessageAttachments';

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
  has_attachments?: boolean;
  message_type?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
};

interface ChatAreaProps {
  onMessageInputFocus?: () => void;
}

export const ChatArea = ({ onMessageInputFocus }: ChatAreaProps = {}) => {
  const { 
    me, 
    currentChannelId, 
    boardOwnerId, 
    isInitialized,
    realtimeEnabled
  } = useChat();
  const { toast } = useToast();
  const location = useLocation();
  
  const [messages, setMessages] = useState<Message[]>([]);
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

  // Active channel ID (context takes precedence)
  const activeChannelId = currentChannelId;

  // Timeout fallback - force channel selection after 3 seconds if none exists
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!activeChannelId && isInitialized) {
        console.log('⏰ Timeout fallback: no channel selected after 3 seconds');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [activeChannelId, isInitialized]);

  // Load channel info with detailed performance logging
  useEffect(() => {
    let active = true;
    
    (async () => {
      if (!activeChannelId) {
        if (active) setChannelInfo(null);
        return;
      }
      
      console.log('🔍 [CHAT-AREA] Step A: Loading channel info for:', activeChannelId);
      const stepAStart = performance.now();
      
      const isPublicBoard = location.pathname.startsWith('/board/');
      
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id, name, is_dm, chat_participants(user_id, sub_user_id, user_type)')
        .eq('id', activeChannelId)
        .maybeSingle();

      console.log('✅ [CHAT-AREA] Step A took:', performance.now() - stepAStart, 'ms');

      if (!active || !channel) return;

      const cps = (channel as any).chat_participants || [];
      const isDM = channel.is_dm || cps.length === 2;
      if (isDM) {
        console.log('🔍 [CHAT-AREA] Step B: Resolving DM partner...');
        const stepBStart = performance.now();
        
        // Find the OTHER participant (not me) - SIMPLIFIED
        const myId = me?.id;
        const myType = me?.type;
        
        const other = cps.find((p: any) => {
          if (myType === 'admin' && p.user_id === myId) return false;
          if (myType === 'sub_user' && p.sub_user_id === myId) return false;
          return true;
        });

        if (other?.user_id) {
          // SIMPLIFIED: Skip admin display name lookup for now
          setChannelInfo({ name: channel.name, isDM: true, dmPartner: { name: 'Admin' } });
        } else if (other?.sub_user_id) {
          // SIMPLIFIED: Skip sub-user lookup for now
          setChannelInfo({ name: channel.name, isDM: true, dmPartner: { name: 'Member' } });
        } else {
          setChannelInfo({ name: channel.name, isDM: true });
        }
        
        console.log('✅ [CHAT-AREA] Step B took:', performance.now() - stepBStart, 'ms');
      } else {
        setChannelInfo({ name: channel.name, isDM: false });
      }
    })();
    
    return () => { active = false; };
  }, [activeChannelId, me, location.pathname]);

  // Load messages with detailed performance logging
  useEffect(() => {
    let active = true;

    const loadMessages = async () => {
      if (!activeChannelId || !me || !boardOwnerId || !isInitialized) {
        console.log('⏭️ [CHAT-AREA] Skipping message load - missing requirements:', {
          activeChannelId: !!activeChannelId,
          me: !!me,
          boardOwnerId: !!boardOwnerId,
          isInitialized
        });
        return;
      }

      console.log('🔍 [CHAT-AREA] Step C: Loading messages...');
      const stepCStart = performance.now();

      try {
        const onPublicBoard = location.pathname.startsWith('/board/');
        const { data: { session } } = await supabase.auth.getSession();
        const isAuthed = !!session?.user?.id;
        
        console.log('🔍 [CHAT-AREA] Message loading context:', {
          activeChannelId,
          me: me?.email,
          myType: me?.type,
          onPublicBoard,
          isAuthed
        });
        
        let data, error;
        
        if (onPublicBoard && me?.type === 'sub_user') {
          console.log('📨 [CHAT-AREA] Using public RPC for sub-user');
          const result = await supabase.rpc('list_channel_messages_public', {
            p_owner_id: boardOwnerId,
            p_channel_id: activeChannelId,
            p_requester_type: 'sub_user',
            p_requester_email: me.email!,
          });
          data = result.data;
          error = result.error;
        } else {
          console.log('📨 [CHAT-AREA] Using authenticated RPC');  
          const result = await supabase.rpc('get_chat_messages_for_channel', {
            p_board_owner_id: boardOwnerId,
            p_channel_id: activeChannelId,
          });
          data = result.data;
          error = result.error;
        }

        console.log('✅ [CHAT-AREA] Step C took:', performance.now() - stepCStart, 'ms');

        if (error) {
          console.error('❌ [CHAT-AREA] Error loading messages:', error);
          if (active) setLoading(false);
          return;
        }

        if (active) {
          console.log('✅ [CHAT-AREA] Loaded', data?.length || 0, 'messages');
          const normalized = (data || []).map((m: any) => ({
            ...m,
            sender_type: m.sender_type as 'admin' | 'sub_user'
          }));

          // Fetch attachments for these messages
          const ids = normalized.map(m => m.id);
          let byMsg: Record<string, any[]> = {};
          if (ids.length) {
            const { data: atts, error: attErr } = await supabase
              .from('chat_message_files')
              .select('*')
              .in('message_id', ids);
            if (!attErr && atts) {
              byMsg = atts.reduce((acc: any, a: any) => {
                (acc[a.message_id] ||= []).push({
                  id: a.id,
                  filename: a.filename,
                  file_path: a.file_path,
                  content_type: a.content_type,
                  size: a.size,
                });
                return acc;
              }, {});
            }
          }

          const withAtts = normalized.map(m => ({
            ...m,
            attachments: byMsg[m.id] || [],
          }));

          setMessages(withAtts);
          cacheRef.current.set(activeChannelId, withAtts);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ [CHAT-AREA] Error in loadMessages:', error);
        if (active) setLoading(false);
      }
    };

    loadMessages();
    return () => { active = false; };
  }, [activeChannelId, boardOwnerId, me?.id, me?.email, location.pathname, isInitialized]);

  // SURGICAL FIX 3: No more "empty on switch" - prefill from cache, don't clear to []
  useEffect(() => {
    if (!activeChannelId) {
      // no channel yet – remain in loader; don't render "empty"
      setMessages([]);
      setLoading(true);
      return;
    }
    const cached = cacheRef.current.get(activeChannelId);
    if (cached?.length) {
      console.log('📋 Using cached messages for channel:', activeChannelId, 'count:', cached.length);
      setMessages(cached);       // instant paint
      setLoading(false);
    } else {
      setLoading(true);          // wait for first fetch
    }
  }, [activeChannelId]);

  // Polling for non-authenticated users only (authenticated users use real-time)
  useEffect(() => {
    if (!activeChannelId || !boardOwnerId || !me) return;
    const guardKey = `${boardOwnerId}:${me.email || me.id}`;
    let mounted = true;
    
    // Check authentication status
    const checkAndPoll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticatedUser = !!session?.user?.id;
      
      // Skip polling only when realtime is actually enabled
      if (realtimeEnabled) {
        console.log('⏭️ Skipping polling - realtime is enabled');
        return;
      }
      
      console.log('📊 Starting polling for public board access');
      
      const poll = async () => {
        if (!mounted) return;
        
        // before applying results, check if identity changed
        const currentGuard = `${boardOwnerId}:${me.email || me.id}`;
        if (currentGuard !== guardKey) return; // identity changed -> ignore batch
        
        const slug = location.pathname.split('/').pop();
        const accessData = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        
        const { data } = await supabase.rpc('list_channel_messages_public', {
          p_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_requester_type: 'sub_user',
          p_requester_email: accessData.email || me.email,
        });
        
        if (!mounted || !data) return;
        
        // SURGICAL FIX 4: Make polling increment unread + reuse the realtime pipeline
        setMessages(prev => {
          const prevIds = new Set(prev.map(m => m.id));
          const newOnes = data.filter(m => !prevIds.has(m.id));

          // Dispatch events so the central handler increments unread + shows badge
          for (const m of newOnes) {
            // Normalize public messages to include owner_id for consistency
            window.dispatchEvent(new CustomEvent('chat-message-received', { 
              detail: { message: { ...m, owner_id: boardOwnerId } } 
            }));
          }

          // Usual merge
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
  }, [activeChannelId, boardOwnerId, me?.email, me?.id, location.pathname, realtimeEnabled]);

  // Listen for real-time messages with cache updates and strict deduplication
  useEffect(() => {
    const handleMessage = async (event: CustomEvent) => {
      let { message } = event.detail as { message: Message };
      const channelId = message.channel_id;
      
      console.log('📨 Real-time message received for channel:', channelId);
      
      // Fetch attachments if message has them
      if (message.has_attachments) {
        const { data: atts } = await supabase
          .from('chat_message_files')
          .select('*')
          .eq('message_id', message.id);
        message = { ...message, attachments: (atts || []).map(a => ({
          id: a.id,
          filename: a.filename,
          file_path: a.file_path,
          content_type: a.content_type,
          size: a.size,
        }))};
      }
      
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

  // Drop all cached messages when identity changes (broadcast by provider)
  useEffect(() => {
    const onReset = () => {
      cacheRef.current.clear();
      setMessages([]);
      setLoading(false);
    };
    window.addEventListener('chat-reset', onReset as EventListener);
    return () => window.removeEventListener('chat-reset', onReset as EventListener);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (content: string, attachments: any[] = []) => {
    if (!content.trim() && attachments.length === 0) return;
    if (!activeChannelId || !boardOwnerId || !me) return;

    // --- OPTIMISTIC UI: build a temporary message and paint immediately
    const tempId = `temp_${Date.now()}`;
    const optimisticAtts = attachments.map((a: any) => {
      // prefer provided public_url (from MessageInput), else derive
      const { data } = supabase.storage.from('chat_attachments').getPublicUrl(a.file_path);
      return {
        id: `tmp_${Math.random().toString(36).slice(2)}`,
        filename: a.filename,
        file_path: a.file_path,
        content_type: a.content_type,
        size: a.size,
        public_url: a.public_url || data.publicUrl,
        object_url: a.object_url, // fast blob preview for images
      };
    });

    const optimisticMessage: Message = {
      id: tempId,
      content: content,
      created_at: new Date().toISOString(),
      sender_type: me.type as 'admin' | 'sub_user',
      sender_name: me.name || me.email || 'Me',
      sender_avatar_url: me.avatarUrl || undefined,
      channel_id: activeChannelId,
      has_attachments: optimisticAtts.length > 0,
      message_type: optimisticAtts.length ? 'file' : 'text',
      attachments: optimisticAtts,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    setSending(true);
    try {
      // send text
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthed = !!session?.user?.id;

      if (me?.type === 'sub_user') {
        const { error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: me.email!,
          p_content: content.trim(),
        });
        if (error) throw error;
      } else if (isAuthed && me?.type === 'admin') {
        const { error } = await supabase.rpc('send_authenticated_message', {
          p_channel_id: activeChannelId,
          p_owner_id: boardOwnerId,
          p_content: content.trim(),
        });
        if (error) throw error;
      } else {
        const slug = location.pathname.split('/').pop()!;
        const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        const senderEmail = me?.email || stored?.email;
        const { error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: senderEmail,
          p_content: content.trim(),
        });
        if (error) throw error;
      }

      // link files to the just-sent message on the server
      if (attachments.length > 0) {
        const { data: msg } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('channel_id', activeChannelId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (msg?.id) {
          if (me?.type === 'admin' && isAuthed) {
            const rows = attachments.map(a => ({
              message_id: msg.id,
              filename: a.filename,
              file_path: a.file_path,
              content_type: a.content_type,
              size: a.size,
            }));
            await supabase.from('chat_message_files').insert(rows);
            await supabase.from('chat_messages')
              .update({ has_attachments: true, message_type: 'file' })
              .eq('id', msg.id);
          } else {
            await supabase.rpc('attach_files_to_message_public', {
              p_owner_id: boardOwnerId,
              p_channel_id: activeChannelId,
              p_sender_email: me.email!,
              p_files: attachments,
            });
          }

          // after files are linked and you have `msg?.id`
          // fetch attachments for the just-created message and broadcast
          const { data: atts } = await supabase
            .from('chat_message_files')
            .select('*')
            .eq('message_id', msg.id);

          const hydrated = {
            id: msg.id,
            content: content.trim(),
            created_at: new Date().toISOString(),
            sender_type: me.type as 'admin' | 'sub_user',
            sender_name: me.name || me.email || 'Me',
            sender_avatar_url: me.avatarUrl || undefined,
            channel_id: activeChannelId,
            has_attachments: !!atts?.length,
            message_type: atts?.length ? 'file' : 'text',
            attachments: (atts || []).map(a => ({
              id: a.id,
              filename: a.filename,
              file_path: a.file_path,
              content_type: a.content_type,
              size: a.size,
            })),
          };

          // 1) drop the temp
          setMessages(prev => prev.filter(m => !m.id.startsWith('temp_')));
          // 2) insert the real one immediately (no waiting for poll)
          setMessages(prev => [...prev, hydrated]);
          // 3) broadcast so other tabs/clients also paint instantly
          window.dispatchEvent(new CustomEvent('chat-message-received', { detail: { message: hydrated } }));
        }
      }
    } catch (e: any) {
      // rollback optimistic if failed
      setMessages(prev => prev.filter(m => m.id !== tempId));
      console.error('❌ Send error:', e);
      toast({
        title: 'Error',
        description: e.message || 'Failed to send',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // No artificial timeout – render loader until we actually finish a fetch.

  // Show loading state while authentication and data are resolving
  if (loading || !isInitialized) {
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
                    {message.attachments && message.attachments.length > 0 && (
                      <MessageAttachments attachments={message.attachments} />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div onFocus={onMessageInputFocus}>
        <MessageInput 
          onSendMessage={send}
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
};