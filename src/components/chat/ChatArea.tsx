import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, ArrowDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { resolveAvatarUrl } from './_avatar';
import { useToast } from '@/hooks/use-toast';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { getEffectivePublicEmail } from '@/utils/chatEmail';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOptimizedChatMessages } from '@/hooks/useOptimizedChatMessages';
import { ChatScrollManager, throttle } from '@/utils/chatScrollManager';
import { MessageSkeletonGroup, LoadingMoreSkeleton } from '@/components/ui/message-skeleton';

type Message = {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  sender_name?: string;
  sender_avatar_url?: string;
  channel_id: string;
  has_attachments?: boolean;
  message_type?: string;
  is_deleted?: boolean;
  edited_at?: string;
  original_content?: string;
  _isUpdate?: boolean;
  attachments?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
    public_url?: string;
    object_url?: string;
  }>;
};

interface ChatAreaProps {
  onMessageInputFocus?: () => void;
}

export const ChatArea = ({ onMessageInputFocus }: ChatAreaProps = {}) => {
  const { me, currentChannelId, boardOwnerId, isInitialized, realtimeEnabled } = useChat();
  const { toast } = useToast();
  const { t } = useLanguage();
  const location = useLocation();

  // Compute effective email using the same logic as ChatSidebar
  const effectiveEmail = getEffectivePublicEmail(location.pathname, me?.email);
  const isPublic = location.pathname.startsWith('/board/');

  // Use optimized chat messages hook
  const { 
    messages, 
    loading, 
    loadingOlder, 
    hasMoreMessages, 
    loadOlderMessages,
    refresh 
  } = useOptimizedChatMessages();

  const [channelInfo, setChannelInfo] = useState<{ 
    name: string; 
    isDM: boolean; 
    dmPartner?: { name: string; avatar?: string } 
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Scroll management
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollManagerRef = useRef<ChatScrollManager | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  
  // Cache and state
  const headerCacheRef = useRef<Map<string, { name: string; isDM: boolean; dmPartner?: { name: string; avatar?: string } }>>(new Map());
  const [generalId, setGeneralId] = useState<string | null>(null);
  const activeChannelId = currentChannelId;

  // Initialize scroll manager
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollManagerRef.current = new ChatScrollManager(scrollAreaRef);
    }
  }, []);

  // Throttled scroll handler
  const handleScroll = useCallback(
    throttle(() => {
      if (!scrollManagerRef.current) return;
      
      const { shouldLoadMore, isAtBottom } = scrollManagerRef.current.handleScroll();
      
      // Show/hide scroll to bottom button
      setShowScrollToBottom(!isAtBottom);
      
      // Load more messages if needed
      if (shouldLoadMore && hasMoreMessages && !loadingOlder) {
        scrollManagerRef.current.maintainScrollPosition(() => {
          loadOlderMessages();
        });
      }
    }, 100),
    [hasMoreMessages, loadingOlder, loadOlderMessages]
  );

  // Scroll to bottom function
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollManagerRef.current) {
      scrollManagerRef.current.scrollToBottom(smooth);
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0 && scrollManagerRef.current) {
      const shouldAutoScroll = scrollManagerRef.current.shouldAutoScrollOnNewMessage();
      if (shouldAutoScroll) {
        setTimeout(() => scrollToBottom(true), 100);
      }
    }
  }, [messages.length, scrollToBottom]);

  // Scroll to bottom when channel changes
  useEffect(() => {
    if (currentChannelId && scrollManagerRef.current) {
      scrollManagerRef.current.reset();
      setShowScrollToBottom(false);
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [currentChannelId, scrollToBottom]);

  // Always clear header on channel switch; we will re-resolve strictly
  useEffect(() => { setChannelInfo(null); }, [activeChannelId]);

  // Resolve current user ID for sub-users on public boards
  useEffect(() => {
    const resolveCurrentUserId = async () => {
      if (!me || !boardOwnerId) {
        setResolvedCurrentUserId(null);
        return;
      }

      // For admins or internal boards, use the ID as-is
      if (me.type === 'admin' || !isPublic) {
        setResolvedCurrentUserId(me.id);
        return;
      }

      // For sub-users on public boards, resolve UUID by email if ID is email-based
      if (me.type === 'sub_user' && isPublic && me.email && me.id?.includes('@')) {
        console.log('🔍 Resolving current user UUID by email for public board:', me.email);
        const { data: subUser } = await supabase
          .from('sub_users')
          .select('id')
          .eq('board_owner_id', boardOwnerId)
          .eq('email', me.email)
          .maybeSingle();
        if (subUser?.id) {
          setResolvedCurrentUserId(subUser.id);
          console.log('✅ Resolved current user UUID:', subUser.id);
        } else {
          setResolvedCurrentUserId(me.id);
        }
      } else {
        setResolvedCurrentUserId(me.id);
      }
    };

    resolveCurrentUserId();
  }, [me?.id, me?.type, me?.email, boardOwnerId, isPublic]);

  // helper for clean display names (for message bubbles, not header)
  const nameFor = (m: Message) =>
    (m.sender_name && m.sender_name.trim())
    || (me?.name?.trim() || (me as any)?.full_name?.trim())
    || 'User';

  // Normalize admin display name (avoid auto-generated "user_*")
  const normalizeAdminName = (username?: string | null) => {
    if (!username) return 'Admin';
    return username.startsWith('user_') ? 'Admin' : username;
  };

  // Load the General channel id (so General can never show a person's name)
  useEffect(() => {
    if (!boardOwnerId) { setGeneralId(null); return; }
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_default_channel_for_board', {
          p_board_owner_id: boardOwnerId
        });
        if (error) { setGeneralId(null); return; }
        setGeneralId(data?.[0]?.id ?? null);
      } catch { setGeneralId(null); }
    })();
  }, [boardOwnerId, location.pathname]);

  // Strict header resolver (no guessing)
  useEffect(() => {
    const resolveHeader = async () => {
      if (!activeChannelId || !boardOwnerId) return;

      // Cached?
      const cached = headerCacheRef.current.get(activeChannelId);
      if (cached) { setChannelInfo(cached); return; }

      // 1) If this is the known General channel => force "General".
      if (generalId && activeChannelId === generalId) {
        const info = { name: t('chat.general'), isDM: false } as const;
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }

      // 2) Use unified participant-based resolution for both internal and public boards
      // What kind of channel is this?
      const { data: ch, error: chErr } = await supabase
        .from('chat_channels')
        .select('name, is_dm')
        .eq('id', activeChannelId)
        .maybeSingle();
      if (chErr) {
        console.log('❌ Failed to fetch channel info:', chErr);
        return;
      }

      // Non-DM: trust channel's own name (or General fallback)
      if (!ch?.is_dm) {
        const info = { name: ch?.name || t('chat.general'), isDM: false } as const;
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }

      // DM: Use direct participant resolution for both internal and public boards
      console.log('🔍 Resolving DM header for channel:', activeChannelId, 'me:', { type: me?.type, id: me?.id, isPublic });
      
      const { data: parts } = await supabase
        .from('chat_participants')
        .select('user_type, user_id, sub_user_id')
        .eq('channel_id', activeChannelId);
      
      console.log('👥 Found participants:', parts);
      if (!parts || parts.length === 0) {
        console.log('❌ No participants found, fallback to General');
        const info = { name: t('chat.general'), isDM: false } as const;
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }

      const myType = me?.type;
      const myId   = me?.id;
      let myUUID = myId; // Default to original ID
      
      // For sub-users on public boards, we might need to resolve by email if ID is email-based
      if (myType === 'sub_user' && isPublic && me?.email && myId?.includes('@')) {
        console.log('🔍 Resolving sub-user UUID by email for public board:', me.email);
        const { data: subUser } = await supabase
          .from('sub_users')
          .select('id')
          .eq('board_owner_id', boardOwnerId)
          .eq('email', me.email)
          .maybeSingle();
        if (subUser?.id) {
          myUUID = subUser.id;
          console.log('✅ Resolved sub-user UUID:', myUUID);
        }
      }
      
      const other = parts.find(p => {
        if (myType === 'admin') {
          return (p.user_type === 'sub_user') ||
                 (p.user_type === 'admin' && p.user_id !== myUUID);
        } else if (myType === 'sub_user') {
          return (p.user_type === 'admin') ||
                 (p.user_type === 'sub_user' && p.sub_user_id !== myUUID);
        }
        return false;
      });
      
      console.log('👤 Found other participant:', other, 'using myUUID:', myUUID);
      if (!other) {
        console.log('❌ No other participant found, fallback to General');
        const info = { name: t('chat.general'), isDM: false } as const;
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }

      // Fetch partner profile
      let partnerName = 'Direct Message';
      let partnerAvatar: string | undefined;

      if (other.user_type === 'admin' && other.user_id) {
        console.log('🔍 Fetching admin profile for:', other.user_id);
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', other.user_id)
          .maybeSingle();
        console.log('👤 Admin profile:', prof);
        partnerName   = normalizeAdminName(prof?.username) || 'Admin';
        partnerAvatar = prof?.avatar_url || undefined;
      } else if (other.user_type === 'sub_user' && other.sub_user_id) {
        console.log('🔍 Fetching sub-user profile for:', other.sub_user_id);
        const { data: su } = await supabase
          .from('sub_users')
          .select('fullname, email, avatar_url')
          .eq('id', other.sub_user_id)
          .maybeSingle();
        console.log('👤 Sub-user profile:', su);
        partnerName   = (su?.fullname && su.fullname.trim()) || su?.email || 'Member';
        partnerAvatar = su?.avatar_url || undefined;
      }

      console.log('✅ Resolved DM header:', { partnerName, partnerAvatar, isPublic });
      const info = { name: partnerName, isDM: true, dmPartner: { name: partnerName, avatar: partnerAvatar } } as const;
      headerCacheRef.current.set(activeChannelId, info);
      setChannelInfo(info);
    };
    resolveHeader();
  }, [activeChannelId, boardOwnerId, generalId, isPublic, effectiveEmail, me?.id, me?.type]);

  // Message-related functions
  const sendMessage = useCallback(async (content: string, attachments: any[] = [], replyToId?: string) => {
    if (!currentChannelId || !me || (!content.trim() && attachments.length === 0)) return;

    try {
      const messageData: any = {
        content: content.trim(),
        channel_id: currentChannelId,
        sender_type: me.type,
        has_attachments: attachments.length > 0,
        message_type: attachments.length > 0 ? 'file' : 'text'
      };

      if (me.type === 'admin') {
        messageData.sender_user_id = resolvedCurrentUserId || me.id;
      } else {
        messageData.sender_sub_user_id = resolvedCurrentUserId || me.id;
      }

      if (replyToId) messageData.reply_to_id = replyToId;

      const { data: newMessage, error } = await supabase
        .from('chat_messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      // Handle file attachments
      if (attachments.length > 0 && newMessage) {
        const fileRecords = attachments.map(file => ({
          message_id: newMessage.id,
          filename: file.filename,
          file_path: file.file_path,
          content_type: file.content_type,
          size: file.size
        }));
        
        await supabase.from('chat_message_files').insert(fileRecords);
      }

      // Enable auto-scroll when user sends message
      if (scrollManagerRef.current) {
        scrollManagerRef.current.enableAutoScroll();
      }
      
      // Refresh to get latest messages
      setTimeout(() => {
        refresh();
        scrollToBottom(true);
      }, 100);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentChannelId, me, resolvedCurrentUserId, refresh, scrollToBottom, toast]);

  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    try {
      const { error } = await supabase.functions.invoke('edit-message', {
        body: { messageId, content }
      });

      if (error) throw error;
      
      setEditingMessage(null);
      refresh();
    } catch (error) {
      console.error('❌ Error editing message:', error);
      toast({
        title: "Error",
        description: "Failed to edit message. Please try again.",
        variant: "destructive",
      });
    }
  }, [refresh, toast]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-message', {
        body: { messageId }
      });

      if (error) throw error;
      
      refresh();
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    }
  }, [refresh, toast]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Initializing chat...</div>
      </div>
    );
  }

  if (!activeChannelId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-2">{t('chat.selectChannel')}</h3>
        <p className="text-muted-foreground text-sm">{t('chat.selectChannelDescription')}</p>
      </div>
    );
  }

  const showAvatar = channelInfo?.isDM ? resolveAvatarUrl(channelInfo.dmPartner?.avatar) : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          {showAvatar && (
            <div className="relative">
              <img
                src={showAvatar}
                alt={channelInfo?.name || 'Avatar'}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-lg">
              {channelInfo?.name || t('chat.loading')}
            </h3>
            {channelInfo?.isDM && (
              <p className="text-xs text-muted-foreground">{t('chat.directMessage')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea 
          className="h-full" 
          ref={scrollAreaRef}
          onScrollCapture={handleScroll}
        >
          <div ref={messageListRef} className="p-4">
            {/* Loading older messages */}
            {loadingOlder && (
              <LoadingMoreSkeleton />
            )}
            
            {/* Initial loading */}
            {loading ? (
              <MessageSkeletonGroup count={5} />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-lg mb-2">{t('chat.noMessages')}</h3>
                <p className="text-muted-foreground text-sm">{t('chat.startConversation')}</p>
              </div>
            ) : (
              <MessageList
                messages={messages.map(m => ({ ...m, updated_at: m.updated_at || m.created_at }))}
                currentUser={
                  me
                    ? {
                        id: resolvedCurrentUserId || me.id || '',
                        type: me.type as 'admin' | 'sub_user',
                        name: nameFor({ sender_name: me.name || (me as any)?.full_name } as Message),
                      }
                    : null
                }
                onReply={(messageId) => {
                  const msg = messages.find(m => m.id === messageId);
                  setReplyingTo(msg ? { ...msg, updated_at: msg.updated_at || msg.created_at } : null);
                }}
                onEdit={(message) => setEditingMessage({ ...message, updated_at: message.updated_at || message.created_at })}
                onDelete={handleDeleteMessage}
              />
            )}
          </div>
        </ScrollArea>

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-4 right-4 rounded-full shadow-lg z-10"
            onClick={() => scrollToBottom(true)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSendMessage={sendMessage}
        replyingTo={replyingTo ? { ...replyingTo, updated_at: replyingTo.updated_at || replyingTo.created_at } : null}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage ? { ...editingMessage, updated_at: editingMessage.updated_at || editingMessage.created_at } : null}
        onCancelEdit={() => setEditingMessage(null)}
        onEditMessage={handleEditMessage}
      />
    </div>
  );
};

export default ChatArea;