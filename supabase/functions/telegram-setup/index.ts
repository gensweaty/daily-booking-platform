import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || 'connect_legacy';

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolve user_id from JWT or body
    let userId = body.user_id;
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseAuth = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabaseAuth.auth.getUser();
        userId = user?.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── STATUS ──
    if (action === 'status') {
      const { data: config } = await supabaseAdmin
        .from('telegram_bot_configs')
        .select('bot_username, is_active, telegram_chat_id')
        .eq('user_id', userId)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          connected: !!config?.is_active,
          bot_username: config?.bot_username ?? null,
          chat_linked: !!config?.telegram_chat_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── CONNECT ──
    const bot_token = body.bot_token;
    if (!bot_token) {
      return new Response(
        JSON.stringify({ error: 'bot_token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the bot token
    const getMeResponse = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const getMeData = await getMeResponse.json();

    if (!getMeResponse.ok || !getMeData.ok) {
      console.error('❌ Invalid bot token:', getMeData);
      return new Response(
        JSON.stringify({ error: 'Invalid bot token. Please check and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const botUsername = getMeData.result.username;
    console.log(`✅ Bot validated: @${botUsername}`);

    // Save timezone if provided
    const timezone = body.timezone;
    if (timezone) {
      await supabaseAdmin
        .from('profiles')
        .update({ timezone })
        .eq('id', userId);
    }

    // Upsert config
    const { data, error } = await supabaseAdmin
      .from('telegram_bot_configs')
      .upsert({
        user_id: userId,
        bot_token,
        bot_username: botUsername,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('❌ DB error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save bot configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Bot config saved for user ${userId}: @${botUsername}`);

    return new Response(
      JSON.stringify({
        success: true,
        bot_username: botUsername,
        message: `Bot @${botUsername} connected successfully!`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ telegram-setup error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
