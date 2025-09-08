import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { chatPerformanceManager } from '@/utils/chatPerformanceManager';
import { performanceOptimizer } from '@/utils/performanceOptimizer';

export interface OptimizedChatMessage {
  id: string;
  content: string;
  channel_id: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  created_at: string;
  updated_at: string;
  sender_name?: string;
  sender_avatar_url?: string;
  has_attachments?: boolean;
  message_type?: string;
  is_deleted?: boolean;
  edited_at?: string;
  original_content?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
}

interface UseOptimizedChatMessagesProps {
  channelId: string | null;
  userId?: string;
  isPublic?: boolean;
  realtimeEnabled?: boolean;
}

export const useOptimizedChatMessages = ({
  channelId,
  userId,
  isPublic = false,
  realtimeEnabled = true
}: UseOptimizedChatMessagesProps) => {
  const location = useLocation();
  const [messages, setMessages] = useState<OptimizedChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadingRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<any>(null);
  const lastMessageTimestamp = useRef<string | null>(null);

  // Optimized message loading with caching
  const loadMessagesOptimized = useCallback(async (
    targetChannelId: string,
    offset: number = 0,
    limit?: number
  ): Promise<OptimizedChatMessage[]> => {
    if (!limit) {
      limit = chatPerformanceManager.getOptimalBatchSize();
    }

    const cacheKey = `messages-${targetChannelId}-${offset}-${limit}`;
    
    // Try cache first for initial load
    if (offset === 0) {
      const cached = await chatPerformanceManager.getCachedMessages(targetChannelId);
      if (cached) {
        console.log('📦 Using cached messages for channel:', targetChannelId);
        return cached;
      }
    }

    // Debounce the request to prevent rapid-fire calls
    return chatPerformanceManager.debounceRequest(
      cacheKey,
      async () => {
        console.log('🔄 Loading messages:', { targetChannelId, offset, limit });
        
        let query = supabase
          .from('chat_messages')
          .select(`
            id,
            content,
            channel_id,
            sender_user_id,
            sender_sub_user_id,
            sender_type,
            created_at,
            updated_at,
            has_attachments,
            message_type,
            is_deleted,
            edited_at,
            original_content
          `)
          .eq('channel_id', targetChannelId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data: messagesData, error: messagesError } = await query;

        if (messagesError) {
          console.error('❌ Error loading messages:', messagesError);
          throw messagesError;
        }

        // Reverse to show chronologically
        const messages = (messagesData || []).reverse();

        // Get unique message IDs for batch attachment loading
        const messageIds = messages
          .filter(msg => msg.has_attachments)
          .map(msg => msg.id);

        let allAttachments: any[] = [];
        if (messageIds.length > 0) {
          // Try to get cached attachments first
          const cachedAttachments = await Promise.all(
            messageIds.map(id => chatPerformanceManager.getCachedAttachments(id))
          );

          const uncachedMessageIds = messageIds.filter((id, index) => !cachedAttachments[index]);
          
          if (uncachedMessageIds.length > 0) {
            // Batch load uncached attachments
            const { data: attachmentsData, error: attachmentsError } = await supabase
              .from('chat_message_files')
              .select('*')
              .in('message_id', uncachedMessageIds);

            if (!attachmentsError) {
              allAttachments = attachmentsData || [];
              
              // Cache the new attachments
              for (const messageId of uncachedMessageIds) {
                const messageAttachments = allAttachments.filter(att => att.message_id === messageId);
                if (messageAttachments.length > 0) {
                  await chatPerformanceManager.setCachedAttachments(messageId, messageAttachments);
                }
              }
            }
          }

          // Combine cached and fresh attachments
          cachedAttachments.forEach((cached, index) => {
            if (cached) {
              allAttachments.push(...cached);
            }
          });
        }

        // Enrich messages with sender names and attachments
        const enrichedMessages = await Promise.all(
          messages.map(async (msg: any) => {
            let senderName = 'Unknown User';
            
            if (msg.sender_type === 'admin' && msg.sender_user_id) {
              senderName = 'Admin';
            } else if (msg.sender_type === 'sub_user' && msg.sender_sub_user_id) {
              // For sub users, get from sub_users table
              const { data: subUser } = await supabase
                .from('sub_users')
                .select('fullname, email')
                .eq('id', msg.sender_sub_user_id)
                .single();
              
              senderName = subUser?.fullname || subUser?.email || 'Sub User';
            }

            const messageAttachments = allAttachments.filter(att => att.message_id === msg.id);

            return {
              ...msg,
              updated_at: msg.updated_at || msg.created_at, // Ensure updated_at is always present
              sender_name: senderName,
              attachments: messageAttachments.map((att: any) => ({
                id: att.id,
                filename: att.filename,
                file_path: att.file_path,
                content_type: att.content_type,
                size: att.size,
              }))
            };
          })
        );

        // Cache the results for the initial load
        if (offset === 0) {
          await chatPerformanceManager.setCachedMessages(targetChannelId, enrichedMessages);
        }

        return enrichedMessages;
      },
      200 // Debounce delay
    );
  }, []);

  // Load initial messages
  const loadMessages = useCallback(async (forceRefresh: boolean = false) => {
    if (!channelId || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      if (forceRefresh) {
        await chatPerformanceManager.removeCachedMessages(channelId);
      }

      const freshMessages = await loadMessagesOptimized(channelId, 0);
      setMessages(freshMessages);
      setHasMoreMessages(freshMessages.length >= chatPerformanceManager.getOptimalBatchSize());
      
      if (freshMessages.length > 0) {
        lastMessageTimestamp.current = freshMessages[freshMessages.length - 1].created_at;
      }
      
      console.log('✅ Messages loaded successfully:', freshMessages.length);
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to load messages');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [channelId, loadMessagesOptimized]);

  // Load more messages (infinite scroll)
  const loadMoreMessages = useCallback(async () => {
    if (!channelId || loadingMore || !hasMoreMessages) return;

    setLoadingMore(true);
    try {
      const olderMessages = await loadMessagesOptimized(channelId, messages.length);
      
      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
      } else {
        setMessages(prev => [...olderMessages, ...prev]);
        setHasMoreMessages(olderMessages.length >= chatPerformanceManager.getOptimalBatchSize());
      }
    } catch (error) {
      console.error('❌ Failed to load more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [channelId, messages.length, loadingMore, hasMoreMessages, loadMessagesOptimized]);

  // Smart polling for public boards
  const setupPolling = useCallback(() => {
    if (!isPublic || !channelId) return;

    const pollInterval = chatPerformanceManager.getOptimalPollingInterval();
    
    pollingRef.current = setInterval(async () => {
      if (document.hidden) return; // Don't poll when tab is hidden
      
      try {
        // Only check for new messages since last timestamp
        if (lastMessageTimestamp.current) {
          const { data: newMessages, error } = await supabase
            .from('chat_messages')
            .select('id, created_at')
            .eq('channel_id', channelId)
            .gt('created_at', lastMessageTimestamp.current)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && newMessages && newMessages.length > 0) {
            // New messages detected, refresh
            loadMessages(true);
          }
        }
      } catch (error) {
        console.warn('Polling error:', error);
      }
    }, pollInterval);

    console.log(`🔄 Polling setup with ${pollInterval}ms interval`);
  }, [isPublic, channelId, loadMessages]);

  // Setup realtime subscription
  const setupRealtime = useCallback(() => {
    if (!realtimeEnabled || !channelId || !chatPerformanceManager.shouldUseRealtime()) {
      return;
    }

    console.log('📡 Setting up realtime for channel:', channelId);
    
    subscriptionRef.current = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          console.log('🔔 Message change detected:', payload.eventType);
          
          // Use throttled refresh to prevent excessive updates
          const throttledRefresh = performanceOptimizer.throttle(() => {
            loadMessages(true);
          }, 1000);
          
          throttledRefresh();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });
  }, [realtimeEnabled, channelId, loadMessages]);

  // Cleanup subscriptions and polling
  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  }, []);

  // Effect to setup data loading and subscriptions
  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    cleanup();
    loadMessages();

    // Setup appropriate update mechanism
    if (isPublic) {
      setupPolling();
    } else {
      setupRealtime();
    }

    return cleanup;
  }, [channelId, isPublic, realtimeEnabled, loadMessages, setupPolling, setupRealtime, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    messages,
    loading,
    loadingMore,
    hasMoreMessages,
    error,
    loadMessages: () => loadMessages(true),
    loadMoreMessages,
    performanceStats: chatPerformanceManager.getPerformanceStats()
  };
};