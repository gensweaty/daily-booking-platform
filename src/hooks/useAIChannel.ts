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
      console.log('🤖 Initializing per-member AI channel:', { userIdentity });
      try {
        setLoading(true);
        setError(null);
        
        // Extract owner_id from identity string
        const ownerId = userIdentity.startsWith('A:') 
          ? userIdentity.substring(2) 
          : userIdentity.startsWith('S:')
            ? userIdentity.split(':')[0] // will be resolved in RPC
            : userIdentity; // email format
        
        // For admin, extract UUID; for sub-user or email, pass the full identity
        const ownerUuid = userIdentity.startsWith('A:') ? ownerId : ownerId;
        
        const { data, error: rpcError } = await supabase
          .rpc('ensure_unique_ai_channel', { 
            p_owner_id: ownerUuid,
            p_user_identity: userIdentity
          });
        
        if (rpcError) {
          console.error('❌ Failed to init per-member AI channel:', rpcError);
          throw rpcError;
        }
        
        console.log('✅ Per-member AI channel initialized:', data);
        setAiChannelId(data);
      } catch (err) {
        console.error('❌ Error initializing per-member AI channel:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initAIChannel();
  }, [userIdentity]);

  return { aiChannelId, loading, error };
}
