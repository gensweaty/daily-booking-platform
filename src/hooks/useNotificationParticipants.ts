import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EnrichedParticipant {
  user_id: string | null;
  sub_user_id: string | null;
  user_type: string;
  email?: string;
}

/**
 * Hook to fetch and cache channel participants for notification targeting.
 * This enables recipient-centric notification routing by determining who should
 * receive notifications based on their identity (admin vs sub-user), not the sender's route.
 */
export const useNotificationParticipants = () => {
  // Cache participants per channel to avoid repeated database queries
  const cacheRef = useRef<Map<string, { data: EnrichedParticipant[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 30000; // 30 seconds cache

  const getChannelParticipants = useCallback(async (channelId: string): Promise<EnrichedParticipant[]> => {
    const now = Date.now();
    const cached = cacheRef.current.get(channelId);
    
    // Return cached data if still valid
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }

    try {
      // Fetch participants from database
      const { data: participants, error } = await supabase
        .from('chat_participants')
        .select('user_id, sub_user_id, user_type')
        .eq('channel_id', channelId);

      if (error || !participants) {
        console.error('Error fetching participants:', error);
        return [];
      }

      // Enrich sub-users with their emails for fallback matching
      const enriched: EnrichedParticipant[] = await Promise.all(
        participants.map(async (p) => {
          if (p.user_type === 'sub_user' && p.sub_user_id) {
            const { data: subUser } = await supabase
              .from('sub_users')
              .select('email')
              .eq('id', p.sub_user_id)
              .maybeSingle();
            return {
              ...p,
              email: subUser?.email?.toLowerCase() || undefined
            };
          }
          return { ...p, email: undefined };
        })
      );

      // Update cache
      cacheRef.current.set(channelId, { data: enriched, timestamp: now });
      
      // Cleanup old cache entries (keep max 50 channels)
      if (cacheRef.current.size > 50) {
        const entries = Array.from(cacheRef.current.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, entries.length - 50);
        toRemove.forEach(([key]) => cacheRef.current.delete(key));
      }

      return enriched;
    } catch (error) {
      console.error('Error in getChannelParticipants:', error);
      return [];
    }
  }, []);

  const invalidateChannel = useCallback((channelId: string) => {
    cacheRef.current.delete(channelId);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    getChannelParticipants,
    invalidateChannel,
    clearCache
  };
};
