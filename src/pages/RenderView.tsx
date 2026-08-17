import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Headless render entry point: /render/:token
 *
 * Exchanges a single-use render token for a short-lived session, then hands
 * over to the dashboard in render mode so our headless browser can capture it.
 * Never linked from the UI — tokens are minted server-side and expire fast.
 */
export default function RenderView() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!token) {
        setError('missing token');
        return;
      }
      try {
        const { data, error: fnError } = await supabase.functions.invoke('render-session', {
          body: { token },
        });
        if (fnError) throw fnError;
        if (!data?.access_token || !data?.refresh_token) {
          throw new Error(data?.error || 'session unavailable');
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) throw sessionError;
        if (cancelled) return;

        const params = new URLSearchParams({ render: '1' });
        if (data.page_hint) params.set('hint', String(data.page_hint));
        if (data.popup_target) params.set('popup', String(data.popup_target));
        window.location.replace(`/dashboard?${params.toString()}`);
      } catch (e: any) {
        console.error('[RenderView] token exchange failed:', e);
        if (!cancelled) setError(e?.message || 'render token exchange failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div
      data-render-error={error ? 'true' : 'false'}
      style={{ padding: 24, fontFamily: 'monospace', opacity: 0.6 }}
    >
      {error ? `Render failed: ${error}` : 'Preparing render…'}
    </div>
  );
}
