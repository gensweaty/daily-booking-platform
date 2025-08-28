import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

    // Use stable channel name to prevent rate limits
    const channelName = `enhanced-chat-${config.boardOwnerId}`;
    console.log('🔗 Setting up enhanced realtime connection:', channelName);

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
          console.log('📨 Enhanced realtime message:', payload);
          config.onNewMessage(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('📡 Enhanced subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setRetryCount(0);
          startHeartbeat();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Enhanced channel error:', status);
          setConnectionStatus('disconnected');
          
          // Exponential backoff retry with max attempts
          if (retryCount < 5) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            setRetryCount(prev => prev + 1);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(`🔄 Retrying enhanced connection (attempt ${retryCount + 1}) in ${delay}ms`);
              setupConnection();
            }, delay);
          } else {
            console.error('❌ Max retry attempts reached for enhanced connection');
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