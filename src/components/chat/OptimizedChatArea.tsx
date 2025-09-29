import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Loader2, Users } from 'lucide-react';
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
import { detectNetworkQuality, isSlowNetwork, getOptimalPageSize, getOptimalPollingInterval } from '@/utils/networkDetector';
import { ParticipantDropdown } from './ParticipantDropdown';
import { useChannelParticipants } from '@/hooks/useChannelParticipants';

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

  // Network optimization
  const networkInfo = useRef(detectNetworkQuality());
  const isSlowNet = useRef(isSlowNetwork(networkInfo.current));
  const pageSize = useRef(getOptimalPageSize(networkInfo.current));
  const pollingInterval = useRef(getOptimalPollingInterval(networkInfo.current));

  // Compute effective email using the same logic as ChatSidebar
  const effectiveEmail = getEffectivePublicEmail(location.pathname, me?.email);
  const isPublic = location.pathname.startsWith('/board/');
  
  // Resolve sub_user id once on public board (stable identity)
  const [publicSubUserId, setPublicSubUserId] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  
  useEffect(() => {
    (async () => {
      if (!isPublic || !boardOwnerId || !effectiveEmail) { 
        setPublicSubUserId(null); 
        setIdentityError(null);
        return; 
      }
      const { data, error } = await supabase
        .from('sub_users').select('id')
        .eq('board_owner_id', boardOwnerId)
        .ilike('email', effectiveEmail)   // case-insensitive
        .maybeSingle();
      if (error) {
        console.error('❌ Failed to resolve public sub-user ID:', error);
        setIdentityError('Failed to resolve user identity');
      } else if (!data?.id) {
        console.warn('⚠️ No sub-user found for email:', effectiveEmail);
        setIdentityError('User not found in this board');
      } else {
        setIdentityError(null);
      }
      setPublicSubUserId(data?.id ?? null);
    })();
  }, [isPublic, boardOwnerId, effectiveEmail]);

  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [channelInfo, setChannelInfo] = useState<{ 
    name: string; 
    isDM: boolean; 
    dmPartner?: { name: string; avatar?: string };
    avatar_url?: string;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  
  // Participant dropdown state
  const [showParticipants, setShowParticipants] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    name: string;
    email?: string;
    avatar_url?: string;
    type: 'admin' | 'sub_user';
  }>>([]);
  const { fetchChannelParticipants, isLoading: participantsLoading } = useChannelParticipants(teamMembers);
  const [participants, setParticipants] = useState<Array<{
    id: string;
    name: string;
    email?: string;
    avatar_url?: string;
    type: 'admin' | 'sub_user';
    isCurrentUser?: boolean;
  }>>([]);
  
  // Refs for pagination and scroll management
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const oldestMessageId = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, { messages: Message[], hasMore: boolean }>>(new Map());
  const headerCacheRef = useRef<Map<string, { name: string; isDM: boolean; dmPartner?: { name: string; avatar?: string }; avatar_url?: string }>>(new Map());
  
  const activeChannelId = currentChannelId;
  const [generalId, setGeneralId] = useState<string | null>(null);

  // Network quality monitoring
  useEffect(() => {
    const updateNetworkInfo = () => {
      networkInfo.current = detectNetworkQuality();
      isSlowNet.current = isSlowNetwork(networkInfo.current);
      pageSize.current = getOptimalPageSize(networkInfo.current);
      pollingInterval.current = getOptimalPollingInterval(networkInfo.current);
    };

    // Check on connection change
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
      return () => connection.removeEventListener('change', updateNetworkInfo);
    }

    // Fallback: periodic network quality check
    const interval = setInterval(updateNetworkInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  // Helper functions
  const fetchAttachments = async (messageId: string) => {
    try {
      const onPublicBoard = location.pathname.startsWith('/board/');
      if (onPublicBoard && me?.type === 'sub_user') {
        const { data: attRows } = await supabase.rpc('list_files_for_messages_public', {
          p_message_ids: [messageId],
        });
        return (attRows || []).map((a: any) => ({
          id: a.id,
          filename: a.filename,
          file_path: a.file_path,
          content_type: a.content_type,
          size: a.size,
        }));
      }
      const { data: linked } = await supabase
        .from('chat_message_files')
        .select('*')
        .eq('message_id', messageId);
      return (linked || []).map((a: any) => ({
        id: a.id,
        filename: a.filename,
        file_path: a.file_path,
        content_type: a.content_type,
        size: a.size,
      }));
    } catch {
      return [];
    }
  };

  const nameFor = (m: Message) =>
    (m.sender_name && m.sender_name.trim())
    || (me?.name?.trim() || (me as any)?.full_name?.trim())
    || 'User';

  const normalizeAdminName = (username?: string | null) => {
    if (!username) return 'Admin';
    return username.startsWith('user_') ? 'Admin' : username;
  };

  // Clear state on channel switch
  useEffect(() => {
    setChannelInfo(null);
    setMessages([]);
    setLoading(true);
    setHasMoreMessages(true);
    oldestMessageId.current = null;
  }, [activeChannelId]);

  // Load General channel ID
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

  // Channel header resolution
  useEffect(() => {
    const resolveHeader = async () => {
      if (!activeChannelId || !boardOwnerId) return;

      const cached = headerCacheRef.current.get(activeChannelId);
      if (cached) { setChannelInfo(cached); return; }

      if (generalId && activeChannelId === generalId) {
        const info = { name: t('chat.general'), isDM: false } as const;
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }

      const { data: ch } = await supabase
        .from('chat_channels')
        .select('name, is_dm, avatar_url')
        .eq('id', activeChannelId)
        .maybeSingle();

      if (!ch?.is_dm) {
        const info = { 
          name: ch?.name || t('chat.general'), 
          isDM: false,
          avatar_url: ch?.avatar_url 
        } as const;
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }

      // DM resolution logic - use different paths for public vs internal
      if (isPublic) {
        const { data: pub } = await supabase.rpc('get_channel_header_public', {
          p_channel_id: activeChannelId,
          p_owner_id: boardOwnerId,
          p_requester_email: effectiveEmail || ''
        });
        const row = pub?.[0];
        const info = row
          ? { name: row.partner_name || t('chat.directMessage'),
              isDM: true,
              dmPartner: { name: row.partner_name, avatar: row.partner_avatar_url } }
          : { name: t('chat.directMessage'), isDM: true };
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }
      
      const { data: parts } = await supabase
        .from('chat_participants')
        .select('user_type, user_id, sub_user_id')
        .eq('channel_id', activeChannelId);

      if (!parts || parts.length === 0) {
        const info = { name: t('chat.general'), isDM: false } as const;
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }

      // Find the other participant
      const otherParticipant = parts.find(p => {
        if (me?.type === 'admin') {
          return p.user_type === 'sub_user' || (p.user_type === 'admin' && p.user_id !== me.id);
        } else {
          return p.user_type === 'admin' || (p.user_type === 'sub_user' && p.sub_user_id !== me.id);
        }
      });

      if (!otherParticipant) {
        const info = { name: 'Direct Message', isDM: true } as const;
        headerCacheRef.current.set(activeChannelId, info);
        setChannelInfo(info);
        return;
      }

      // Get participant details
      let partnerName = 'User';
      let partnerAvatar: string | undefined;

      if (otherParticipant.user_type === 'admin') {
        const { data: adminData } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', otherParticipant.user_id)
          .maybeSingle();
        
        partnerName = normalizeAdminName(adminData?.username) || 'Admin';
        partnerAvatar = adminData?.avatar_url || undefined;
      } else {
        const { data: subUserData } = await supabase
          .from('sub_users')
          .select('fullname, avatar_url')
          .eq('id', otherParticipant.sub_user_id)
          .maybeSingle();
        
        partnerName = subUserData?.fullname || 'User';
        partnerAvatar = subUserData?.avatar_url || undefined;
      }

      const info = { 
        name: partnerName, 
        isDM: true, 
        dmPartner: { name: partnerName, avatar: partnerAvatar } 
      } as const;
      headerCacheRef.current.set(activeChannelId, info);
      setChannelInfo(info);
    };

    resolveHeader();
  }, [activeChannelId, boardOwnerId, generalId, t, me]);

  // Paged message loading
  const loadMessages = useCallback(async (channelId: string, beforeMessageId?: string, append = false) => {
    if (!channelId || !me || !boardOwnerId || !isInitialized) return;

    try {
      const onPublicBoard = location.pathname.startsWith('/board/');
      
      // Optimized: Skip auth session check for faster loading
      let data, error;
      
      if (onPublicBoard && me?.type === 'sub_user') {
        if (!publicSubUserId) {
          // Only show error if we've tried to resolve identity and failed, not during initial loading
          if (identityError) {
            console.error('[chat] Failed to resolve sub_user identity:', identityError);
            toast({ 
              title: "Chat Error", 
              description: identityError, 
              variant: "destructive" 
            });
          } else {
            // Still resolving identity, don't show error yet
            console.log('[chat] Waiting for sub_user identity resolution...');
          }
          return;
        }
        // Use the new v2 RPC with stable identity
        const result = await supabase.rpc('list_channel_messages_public_v2', {
          p_owner_id: boardOwnerId,
          p_channel_id: channelId,
          p_requester_sub_user_id: publicSubUserId,
        });
        data = result.data;
        error = result.error;
        
        // Client-side pagination for public boards (since we don't have paged function)
        if (data && beforeMessageId) {
          const beforeIndex = data.findIndex((m: any) => m.id === beforeMessageId);
          if (beforeIndex > 0) {
            data = data.slice(Math.max(0, beforeIndex - pageSize.current), beforeIndex);
          } else {
            data = [];
          }
        } else if (data) {
          // Take latest messages
          data = data.slice(-pageSize.current);
        }
      } else {
        // For authenticated users, use existing function with client-side pagination
        const result = await supabase.rpc('get_chat_messages_for_channel', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: channelId,
        });
        data = result.data;
        error = result.error;

        // Client-side pagination
        if (data && beforeMessageId) {
          const beforeIndex = data.findIndex((m: any) => m.id === beforeMessageId);
          if (beforeIndex > 0) {
            data = data.slice(Math.max(0, beforeIndex - pageSize.current), beforeIndex);
          } else {
            data = [];
          }
        } else if (data) {
          data = data.slice(-pageSize.current);
        }
      }

      if (error || !data) {
        setHasMoreMessages(false);
        return;
      }

      const normalized = (data || []).map((m: any) => ({
        ...m,
        sender_type: m.sender_type as 'admin' | 'sub_user',
        sender_name: (m.sender_name && m.sender_name.trim()) || undefined,
      }));

      // Batch load attachments for better performance
      const ids = normalized.map(m => m.id);
      let byMsg: Record<string, any[]> = {};
      
      if (ids.length && !isSlowNet.current) {
        // Only load attachments on faster networks to avoid delays
        if (onPublicBoard && me?.type === 'sub_user') {
          const { data: attRows } = await supabase.rpc('list_files_for_messages_public', {
            p_message_ids: ids
          });
          if (attRows) {
            byMsg = attRows.reduce((acc: any, a: any) => {
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
        } else {
          const { data: atts } = await supabase
            .from('chat_message_files')
            .select('*')
            .in('message_id', ids);
          if (atts) {
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
      }

      const withAtts = normalized.map(m => ({
        ...m,
        attachments: byMsg[m.id] || [],
      }));

      // Load metadata only for authenticated users and faster networks
      let metaById = new Map<string, any>();
      if (!onPublicBoard && !isSlowNet.current) {
        const { data: meta } = await supabase
          .from('chat_messages')
          .select('id, updated_at, edited_at, original_content, is_deleted')
          .in('id', ids);
        if (meta) metaById = new Map(meta.map((x: any) => [x.id, x]));
      }

      const finalMessages = withAtts.map(m => ({ ...m, ...(metaById.get(m.id) || {}) }));
      
      if (append) {
        setMessages(prev => {
          const combined = [...finalMessages, ...prev];
          const uniqueMessages = Array.from(
            new Map(combined.map(m => [m.id, m])).values()
          ).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
          return uniqueMessages;
        });
      } else {
        setMessages(finalMessages);
        // Cache initial load
        cacheRef.current.set(channelId, { messages: finalMessages, hasMore: finalMessages.length >= pageSize.current });
      }

      // Update pagination state
      if (finalMessages.length > 0) {
        if (!append) {
          oldestMessageId.current = finalMessages[0].id;
        } else {
          oldestMessageId.current = finalMessages[0].id;
        }
      }
      
      setHasMoreMessages(finalMessages.length >= pageSize.current);
      
    } catch (error) {
      console.error('Error loading messages:', error);
      setHasMoreMessages(false);
    }
  }, [me, boardOwnerId, isInitialized, location.pathname, effectiveEmail, publicSubUserId]);

  // Initial message loading
  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      setLoading(true);
      return;
    }

    // Check cache first
    const cached = cacheRef.current.get(activeChannelId);
    if (cached?.messages.length) {
      setMessages(cached.messages);
      setHasMoreMessages(cached.hasMore);
      setLoading(false);
      oldestMessageId.current = cached.messages[0]?.id || null;
      return;
    }

    setLoading(true);
    loadMessages(activeChannelId).finally(() => setLoading(false));
  }, [activeChannelId, loadMessages]);

  // Load older messages
  const loadOlderMessages = useCallback(async () => {
    if (!activeChannelId || !oldestMessageId.current || !hasMoreMessages || loadingOlder) return;
    
    setLoadingOlder(true);
    try {
      await loadMessages(activeChannelId, oldestMessageId.current, true);
    } finally {
      setLoadingOlder(false);
    }
  }, [activeChannelId, hasMoreMessages, loadingOlder, loadMessages]);

  // Fetch team members for participant dropdown
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!boardOwnerId) return;

      try {
        // Fetch admin info
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('id', boardOwnerId)
          .single();

        // Fetch sub-users
        const { data: subUsers } = await supabase
          .from('sub_users')
          .select('id, fullname, email, avatar_url')
          .eq('board_owner_id', boardOwnerId);

        const members = [];
        
        // Add admin
        if (adminProfile) {
          members.push({
            id: adminProfile.id,
            name: adminProfile.username || 'Admin',
            avatar_url: adminProfile.avatar_url,
            type: 'admin' as const
          });
        }

        // Add sub-users
        if (subUsers) {
          subUsers.forEach(subUser => {
            members.push({
              id: subUser.id,
              name: subUser.fullname || 'User',
              email: subUser.email,
              avatar_url: subUser.avatar_url,
              type: 'sub_user' as const
            });
          });
        }

        setTeamMembers(members);
      } catch (error) {
        console.error('Error fetching team members:', error);
        setTeamMembers([]);
      }
    };

    fetchTeamMembers();
  }, [boardOwnerId]);

  // Fetch participants when channel changes
  useEffect(() => {
    const loadParticipants = async () => {
      if (!activeChannelId || !boardOwnerId || teamMembers.length === 0) {
        setParticipants([]);
        return;
      }

      try {
        const fetchedParticipants = await fetchChannelParticipants(activeChannelId);
        setParticipants(fetchedParticipants);
      } catch (error) {
        console.error('Error loading participants:', error);
        setParticipants([]);
      }
    };

    loadParticipants();
  }, [activeChannelId, boardOwnerId, teamMembers, fetchChannelParticipants]);

  // Scroll management
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Handle scroll events for pagination
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = event.currentTarget;
    
    // Load more when scrolled to top
    if (scrollTop < 100 && hasMoreMessages && !loadingOlder) {
      loadOlderMessages();
    }
  }, [hasMoreMessages, loadingOlder, loadOlderMessages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!activeChannelId || !realtimeEnabled) return;

    const subscription = supabase
      .channel(`chat_messages:${activeChannelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${activeChannelId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as any;
            
            // Load attachments for new message
            const attachments = await fetchAttachments(newMessage.id);
            
            const messageWithAttachments = {
              ...newMessage,
              attachments,
              sender_type: newMessage.sender_type as 'admin' | 'sub_user',
            };

            setMessages(prev => {
              const exists = prev.find(m => m.id === newMessage.id);
              if (exists) return prev;
              
              return [...prev, messageWithAttachments].sort(
                (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
              );
            });

            // Auto-scroll to bottom for new messages
            setTimeout(scrollToBottom, 100);
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as any;
            
            setMessages(prev =>
              prev.map(m =>
                m.id === updatedMessage.id
                  ? { ...m, ...updatedMessage, _isUpdate: true }
                  : m
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedMessage = payload.old as any;
            
            setMessages(prev =>
              prev.filter(m => m.id !== deletedMessage.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [activeChannelId, realtimeEnabled, fetchAttachments, scrollToBottom]);

  // Polling fallback for when realtime is disabled
  useEffect(() => {
    if (realtimeEnabled || !activeChannelId) return;

    const interval = setInterval(() => {
      loadMessages(activeChannelId);
    }, pollingInterval.current);

    return () => clearInterval(interval);
  }, [activeChannelId, realtimeEnabled, loadMessages]);

  if (!isInitialized || loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{isSlowNet.current ? t('chat.loadingOptimized') : t('chat.loading')}</span>
        </div>
      </div>
    );
  }

  if (!activeChannelId) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <MessageCircle className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground text-center max-w-md">
          {t('chat.selectChannel')}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {channelInfo?.isDM && channelInfo?.dmPartner?.avatar ? (
              <img 
                src={resolveAvatarUrl(channelInfo.dmPartner.avatar)}
                alt={channelInfo.name}
                className="w-10 h-10 rounded-full"
              />
            ) : channelInfo?.avatar_url ? (
              <img 
                src={channelInfo.avatar_url}
                alt={channelInfo.name}
                className="w-10 h-10 rounded-full"
              />
            ) : channelInfo?.isDM ? (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-semibold">
                  {(channelInfo?.dmPartner?.name || "U").slice(0, 2).toUpperCase()}
                </span>
              </div>
            ) : (
              <MessageCircle className="h-5 w-5" />
            )}
            <div>
              <button
                onClick={() => setShowParticipants(!showParticipants)}
                className="flex items-center space-x-2 hover:bg-accent/50 px-2 py-1 rounded transition-colors"
              >
                <h2 className="font-semibold">{channelInfo?.name || t('chat.loading')}</h2>
                <Users className="h-4 w-4 text-muted-foreground" />
              </button>
              {isSlowNet.current && (
                <p className="text-xs text-muted-foreground">{t('chat.optimizedForSlowNetwork')}</p>
              )}
            </div>
          </div>
        </div>
        
        <ParticipantDropdown
          isOpen={showParticipants}
          participants={participants}
          loading={participantsLoading(activeChannelId || '')}
          onClose={() => setShowParticipants(false)}
        />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" onScrollCapture={handleScroll}>
        <div className="p-4 space-y-4">
          {loadingOlder && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          
          <MessageList
            messages={messages.map(m => ({ ...m, updated_at: m.updated_at || m.created_at }))}
            currentUser={me ? { id: me.id, type: me.type || 'admin', name: me.name || 'User' } : null}
            onReply={(messageId: string) => {
              const msg = messages.find(m => m.id === messageId);
              if (msg) setReplyingTo(msg);
            }}
            onEdit={(message: any) => {
              setEditingMessage(message);
            }}
            onDelete={(messageId: string) => {
              console.log('Delete message:', messageId);
            }}
          />
          
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t p-4">
        <MessageInput
          onSendMessage={(content: string) => console.log('Send:', content)}
          replyingTo={replyingTo ? { ...replyingTo, updated_at: replyingTo.updated_at || replyingTo.created_at } : null}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage ? { ...editingMessage, updated_at: editingMessage.updated_at || editingMessage.created_at } : null}
          onCancelEdit={() => setEditingMessage(null)}
        />
      </div>
    </div>
  );
};
