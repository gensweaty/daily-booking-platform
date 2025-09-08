import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from '@/components/chat/ChatProvider';
import { getEffectivePublicEmail } from '@/utils/chatEmail';

const MESSAGES_PER_PAGE = 50;
const INITIAL_LOAD_COUNT = 50;

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

export const useOptimizedChatMessages = () => {
  const { me, currentChannelId, boardOwnerId, isInitialized, realtimeEnabled } = useChat();
  const location = useLocation();
  const effectiveEmail = getEffectivePublicEmail(location.pathname, me?.email);
  const isPublic = location.pathname.startsWith('/board/');

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessageDate, setOldestMessageDate] = useState<string | null>(null);
  
  // Cache and refs
  const cacheRef = useRef<Map<string, { messages: Message[]; hasMore: boolean; oldestDate: string | null }>>(new Map());
  const realtimeChannelRef = useRef<any>(null);

  // Fetch attachments helper
  const fetchAttachments = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return {};

    try {
      if (isPublic && me?.type === 'sub_user') {
        const { data: attRows } = await supabase.rpc('list_files_for_messages_public', {
          p_message_ids: messageIds,
        });
        return (attRows || []).reduce((acc: any, a: any) => {
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

      const { data: linked } = await supabase
        .from('chat_message_files')
        .select('*')
        .in('message_id', messageIds);
      
      return (linked || []).reduce((acc: any, a: any) => {
        (acc[a.message_id] ||= []).push({
          id: a.id,
          filename: a.filename,
          file_path: a.file_path,
          content_type: a.content_type,
          size: a.size,
        });
        return acc;
      }, {});
    } catch {
      return {};
    }
  }, [isPublic, me?.type]);

  // Load messages with pagination
  const loadMessages = useCallback(async (channelId: string, isInitial = false, beforeDate?: string) => {
    if (!me || !boardOwnerId || !isInitialized) return { messages: [], hasMore: false };

    try {
      const onPublicBoard = location.pathname.startsWith('/board/');
      let data, error;

      if (onPublicBoard && me?.type === 'sub_user') {
        const result = await supabase.rpc('list_channel_messages_public', {
          p_owner_id: boardOwnerId,
          p_channel_id: channelId,
          p_requester_type: 'sub_user',
          p_requester_email: effectiveEmail!,
        });
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase.rpc('get_chat_messages_for_channel', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: channelId,
        });
        data = result.data;
        error = result.error;
      }

      if (error) return { messages: [], hasMore: false };

      // Sort messages by creation date
      const allMessages = (data || []).sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      let messagesToReturn;
      let hasMore = false;

      if (isInitial) {
        // For initial load, get the last N messages
        messagesToReturn = allMessages.slice(-INITIAL_LOAD_COUNT);
        hasMore = allMessages.length > INITIAL_LOAD_COUNT;
      } else if (beforeDate) {
        // For pagination, get messages before the specified date
        const beforeIndex = allMessages.findIndex((m: any) => new Date(m.created_at).getTime() >= new Date(beforeDate).getTime());
        const startIndex = Math.max(0, beforeIndex - MESSAGES_PER_PAGE);
        messagesToReturn = allMessages.slice(startIndex, beforeIndex);
        hasMore = startIndex > 0;
      } else {
        messagesToReturn = allMessages;
        hasMore = false;
      }

      // Normalize messages
      const normalized = messagesToReturn.map((m: any) => ({
        ...m,
        sender_type: m.sender_type as 'admin' | 'sub_user',
        sender_name: (m.sender_name && m.sender_name.trim()) || undefined,
      }));

      // Fetch attachments
      const messageIds = normalized.map((m: any) => m.id);
      const attachmentsByMessage = await fetchAttachments(messageIds);

      // Add attachments to messages
      const withAttachments = normalized.map((m: any) => ({
        ...m,
        attachments: attachmentsByMessage[m.id] || [],
      }));

      // Add metadata for non-public boards
      if (!onPublicBoard) {
        const { data: meta } = await supabase
          .from('chat_messages')
          .select('id, updated_at, edited_at, original_content, is_deleted')
          .in('id', messageIds);
        
        const metaById = new Map((meta || []).map((x: any) => [x.id, x]));
        withAttachments.forEach((m: any) => {
          const metaData = metaById.get(m.id);
          if (metaData) {
            Object.assign(m, metaData);
          }
        });
      }

      return { 
        messages: withAttachments, 
        hasMore,
        oldestDate: withAttachments.length > 0 ? withAttachments[0].created_at : null
      };
    } catch {
      return { messages: [], hasMore: false };
    }
  }, [me, boardOwnerId, isInitialized, location.pathname, effectiveEmail, fetchAttachments]);

  // Initial load
  const loadInitialMessages = useCallback(async () => {
    if (!currentChannelId) return;

    setLoading(true);
    
    // Check cache first
    const cached = cacheRef.current.get(currentChannelId);
    if (cached) {
      setMessages(cached.messages);
      setHasMoreMessages(cached.hasMore);
      setOldestMessageDate(cached.oldestDate);
      setLoading(false);
      return;
    }

    const result = await loadMessages(currentChannelId, true);
    setMessages(result.messages);
    setHasMoreMessages(result.hasMore);
    setOldestMessageDate(result.oldestDate);
    
    // Cache the result
    cacheRef.current.set(currentChannelId, {
      messages: result.messages,
      hasMore: result.hasMore,
      oldestDate: result.oldestDate
    });

    setLoading(false);
  }, [currentChannelId, loadMessages]);

  // Load older messages
  const loadOlderMessages = useCallback(async () => {
    if (!currentChannelId || !hasMoreMessages || loadingOlder || !oldestMessageDate) return;

    setLoadingOlder(true);
    const result = await loadMessages(currentChannelId, false, oldestMessageDate);
    
    if (result.messages.length > 0) {
      setMessages(prev => [...result.messages, ...prev]);
      setHasMoreMessages(result.hasMore);
      setOldestMessageDate(result.oldestDate);
      
      // Update cache
      const cached = cacheRef.current.get(currentChannelId);
      if (cached) {
        cached.messages = [...result.messages, ...cached.messages];
        cached.hasMore = result.hasMore;
        cached.oldestDate = result.oldestDate;
      }
    } else {
      setHasMoreMessages(false);
    }
    
    setLoadingOlder(false);
  }, [currentChannelId, hasMoreMessages, loadingOlder, oldestMessageDate, loadMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!currentChannelId || !realtimeEnabled) return;

    // Clean up previous subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel(`messages:${currentChannelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${currentChannelId}`
        },
        async (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          if (eventType === 'INSERT' && newRecord) {
            // Add new message to the end
            const message: Message = {
              id: newRecord.id,
              content: newRecord.content,
              created_at: newRecord.created_at,
              channel_id: newRecord.channel_id,
              sender_type: newRecord.sender_type as 'admin' | 'sub_user',
              sender_user_id: newRecord.sender_user_id,
              sender_sub_user_id: newRecord.sender_sub_user_id,
              attachments: [],
            };
            
            // Fetch attachments for new message
            const attachments = await fetchAttachments([message.id]);
            message.attachments = attachments[message.id] || [];
            
            setMessages(prev => {
              const exists = prev.some(m => m.id === message.id);
              if (exists) return prev;
              return [...prev, message];
            });
          } else if (eventType === 'UPDATE' && newRecord) {
            // Update existing message
            setMessages(prev => 
              prev.map(m => m.id === newRecord.id ? { ...m, ...newRecord } : m)
            );
          } else if (eventType === 'DELETE' && oldRecord) {
            // Remove deleted message
            setMessages(prev => prev.filter(m => m.id !== oldRecord.id));
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [currentChannelId, realtimeEnabled, fetchAttachments]);

  // Load messages when channel changes
  useEffect(() => {
    if (currentChannelId) {
      loadInitialMessages();
    } else {
      setMessages([]);
      setLoading(true);
      setHasMoreMessages(true);
      setOldestMessageDate(null);
    }
  }, [currentChannelId, loadInitialMessages]);

  // Clear cache when switching channels
  useEffect(() => {
    return () => {
      // Clear cache for old channels to prevent memory leaks
      if (cacheRef.current.size > 10) {
        cacheRef.current.clear();
      }
    };
  }, [currentChannelId]);

  return {
    messages,
    loading,
    loadingOlder,
    hasMoreMessages,
    loadOlderMessages,
    refresh: loadInitialMessages,
  };
};