import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeConfig {
  onNewMessage: (message: any) => void;
  userId?: string;
  boardOwnerId?: string;
  enabled: boolean;
}

export const useEnhancedRealtimeChat = (config: RealtimeConfig) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('🧹 Cleaning up realtime connection');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (channelRef.current?.state === 'joined') {
        // Send a heartbeat to check connection health
        channelRef.current.send({
          type: 'heartbeat',
          payload: { timestamp: Date.now() }
        });
      }
    }, 30000); // 30 second heartbeat
  }, []);

  const setupConnection = useCallback(() => {
    if (!config.enabled || !config.boardOwnerId) {
      console.log('🚫 Realtime connection disabled or missing boardOwnerId');
      setConnectionStatus('disconnected');
      return;
    }

    cleanup();
    setConnectionStatus('connecting');

    // Use board-specific channel name for single subscription per board
    const channelName = `board-chat-${config.boardOwnerId}`;
    console.log('🔗 Setting up single board-wide subscription:', channelName);

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { 
          schema: 'public', 
          table: 'chat_messages', 
          event: 'INSERT', 
          filter: `owner_id=eq.${config.boardOwnerId}` 
        },
        (payload) => {
          console.log('📨 Board-wide realtime message received:', {
            messageId: payload.new.id,
            channelId: payload.new.channel_id,
            senderId: payload.new.sender_user_id || payload.new.sender_sub_user_id,
            content: payload.new.content?.substring(0, 50) + '...'
          });
          config.onNewMessage(payload.new);
        }
      )
      .on('postgres_changes',
        { 
          schema: 'public', 
          table: 'chat_messages', 
          event: 'UPDATE', 
          filter: `owner_id=eq.${config.boardOwnerId}` 
        },
        (payload) => {
          console.log('✏️ Board-wide realtime message updated:', {
            messageId: payload.new.id,
            channelId: payload.new.channel_id,
            senderId: payload.new.sender_user_id || payload.new.sender_sub_user_id,
            content: payload.new.content?.substring(0, 50) + '...',
            edited: !!payload.new.edited_at
          });
          // Send updated message with special flag to indicate it's an update
          config.onNewMessage({ ...payload.new, _isUpdate: true });
        }
      )
      // 🔔 When a file row is inserted, fetch its parent message and emit an update
      .on('postgres_changes',
        { schema: 'public', table: 'chat_message_files', event: 'INSERT' },
        async (payload) => {
          try {
            const msgId = payload.new?.message_id;
            if (!msgId) return;
            const { data: msg } = await supabase
              .from('chat_messages')
              .select('*, owner_id')
              .eq('id', msgId)
              .maybeSingle();
            if (msg && msg.owner_id === config.boardOwnerId) {
              config.onNewMessage({ ...msg, _isUpdate: true, has_attachments: true });
            }
          } catch (e) {
            console.error('⚠️ file insert bridge failed', e);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Board subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setRetryCount(0);
          startHeartbeat();
          console.log('✅ Connected to board-wide chat subscription');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Board subscription error:', status);
          setConnectionStatus('disconnected');
          
          // Exponential backoff retry with max attempts
          if (retryCount < 3) {
            const delay = Math.min(2000 * Math.pow(2, retryCount), 15000);
            setRetryCount(prev => prev + 1);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(`🔄 Retrying board subscription (attempt ${retryCount + 1}) in ${delay}ms`);
              setupConnection();
            }, delay);
          } else {
            console.error('❌ Max retry attempts reached for board subscription');
          }
        }
      });

    channelRef.current = channel;
  }, [config.enabled, config.boardOwnerId, config.onNewMessage, cleanup, startHeartbeat, retryCount]);

  // Setup connection when config changes
  useEffect(() => {
    setupConnection();
    return cleanup;
  }, [setupConnection]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📱 Page hidden - maintaining lightweight connection');
      } else {
        console.log('👁️ Page visible - ensuring full connection');
        if (connectionStatus === 'disconnected') {
          setupConnection();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connectionStatus, setupConnection]);

  return {
    connectionStatus,
    retryCount,
    reconnect: setupConnection,
  };
};