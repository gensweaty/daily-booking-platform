import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAIChannel(
  ownerId: string | null | undefined,
  userIdentity: string | undefined
) {
  const [aiChannelId, setAiChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !userIdentity) {
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc(
          'ensure_unique_ai_channel',
          {
            p_owner_id: ownerId,
            p_user_identity: userIdentity
          }
        );
        if (rpcError) throw rpcError;

        setAiChannelId(typeof data === 'string' ? data : (data as any)?.id ?? null);
      } catch (e) {
        setError(e as Error);
        setAiChannelId(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [ownerId, userIdentity]);

  return { aiChannelId, loading, error };
}
