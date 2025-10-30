import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscriptionPayload {
  userId: string;
  subUserId?: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  userAgent?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: PushSubscriptionPayload = await req.json();
    console.log('[Subscribe] Saving push subscription for user:', payload.userId);

    const { endpoint, keys } = payload.subscription;

    // Check if subscription already exists
    const { data: existing } = await supabaseClient
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .single();

    if (existing) {
      // Update existing subscription
      const { error } = await supabaseClient
        .from('push_subscriptions')
        .update({
          keys,
          user_agent: payload.userAgent,
          last_used_at: new Date().toISOString(),
        })
        .eq('endpoint', endpoint);

      if (error) throw error;

      console.log('[Subscribe] Updated existing subscription');
    } else {
      // Insert new subscription
      const { error } = await supabaseClient
        .from('push_subscriptions')
        .insert({
          user_id: payload.subUserId ? null : payload.userId,
          sub_user_id: payload.subUserId || null,
          endpoint,
          keys,
          user_agent: payload.userAgent,
        });

      if (error) throw error;

      console.log('[Subscribe] Created new subscription');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Subscription saved' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Subscribe] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});