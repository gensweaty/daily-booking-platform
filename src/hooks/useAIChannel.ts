import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAIChannel(userIdentity: string | undefined) {
  const [aiChannelId, setAiChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userIdentity) {
      setLoading(false);
      return;
    }

    const initAIChannel = async () => {
      console.log('🤖 Initializing UNIQUE AI channel for user:', userIdentity);
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: rpcError } = await supabase
          .rpc('ensure_unique_ai_channel', { p_user_identity: userIdentity });
        
        if (rpcError) {
          console.error('❌ Failed to init AI channel:', rpcError);
          throw rpcError;
        }
        
        console.log('✅ AI channel initialized:', data);
        setAiChannelId(data);
      } catch (err) {
        console.error('❌ Error initializing AI channel:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initAIChannel();
  }, [userIdentity]);

  return { aiChannelId, loading, error };
}
