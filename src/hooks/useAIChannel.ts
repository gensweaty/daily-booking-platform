import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAIChannelProps {
  ownerId: string | undefined;
  userType: 'admin' | 'sub_user';
  userId: string | undefined;
}

export function useAIChannel({ ownerId, userType, userId }: UseAIChannelProps) {
  const [aiChannelId, setAiChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !userId) {
      setLoading(false);
      return;
    }

    const initAIChannel = async () => {
      console.log('🤖 Initializing personal AI channel:', { ownerId, userType, userId });
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: rpcError } = await supabase
          .rpc('ensure_personal_ai_channel', { 
            p_owner_id: ownerId,
            p_user_type: userType,
            p_user_id: userId
          });
        
        if (rpcError) {
          console.error('❌ Failed to init personal AI channel:', rpcError);
          throw rpcError;
        }
        
        console.log('✅ Personal AI channel initialized:', data);
        setAiChannelId(data);
      } catch (err) {
        console.error('❌ Error initializing personal AI channel:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initAIChannel();
  }, [ownerId, userType, userId]);

  return { aiChannelId, loading, error };
}
