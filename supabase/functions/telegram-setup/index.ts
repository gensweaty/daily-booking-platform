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
    const { bot_token, user_id } = await req.json();

    if (!bot_token || !user_id) {
      return new Response(
        JSON.stringify({ error: 'bot_token and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the bot token by calling Telegram getMe directly with user's token
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

    // Store in database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Upsert - if user already has a config, update it
    const { data, error } = await supabaseAdmin
      .from('telegram_bot_configs')
      .upsert({
        user_id,
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

    console.log(`✅ Bot config saved for user ${user_id}: @${botUsername}`);

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
