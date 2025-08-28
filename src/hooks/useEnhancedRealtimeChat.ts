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
    if (!config.enabled || !config.userId || !config.boardOwnerId) {
      console.log('🚫 Skipping realtime setup - missing requirements');
      return;
    }

    cleanup(); // Clean up any existing connection

    console.log('🔄 Setting up enhanced realtime connection:', {
      userId: config.userId,
      boardOwnerId: config.boardOwnerId,
      retryCount
    });

    setConnectionStatus('connecting');

    try {
      // Use stable channel name to avoid creating too many channels
      const channelName = `enhanced_chat_${config.boardOwnerId}`;
      
      // Remove any existing channels with this name first
      const existingChannels = supabase.getChannels();
      const existingChannel = existingChannels.find(ch => ch.topic === channelName);
      if (existingChannel) {
        console.log('🧹 Removing existing channel before creating new one:', channelName);
        supabase.removeChannel(existingChannel);
      }
      
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages',
            filter: `owner_id=eq.${config.boardOwnerId}`
          },
          (payload) => {
            console.log('📨 Enhanced realtime message received:', payload);
            config.onNewMessage(payload.new);
          }
        )
        .subscribe((status, error) => {
          console.log('📡 Enhanced subscription status:', status, error);
          
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            setRetryCount(0);
            startHeartbeat();
            console.log('✅ Enhanced realtime connection established');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('disconnected');
            console.error('❌ Enhanced realtime connection failed:', error);
            
            // Handle rate limit specifically
            if (error?.message?.includes('ChannelRateLimitReached')) {
              console.log('⏸️ Rate limit reached, will not retry to avoid more errors');
              return;
            }
            
            // Retry with exponential backoff for other errors
            if (retryCount < 3) {
              const delay = Math.min(2000 * Math.pow(2, retryCount), 15000);
              console.log(`🔄 Retrying connection in ${delay}ms (attempt ${retryCount + 1}/3)`);
              
              reconnectTimeoutRef.current = setTimeout(() => {
                setRetryCount(prev => prev + 1);
                setupConnection();
              }, delay);
            } else {
              console.log('❌ Max retry attempts reached, giving up');
            }
          }
        });

      channelRef.current = channel;

    } catch (error) {
      console.error('❌ Failed to setup enhanced realtime connection:', error);
      setConnectionStatus('disconnected');
    }
  }, [config, retryCount, cleanup, startHeartbeat]);

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