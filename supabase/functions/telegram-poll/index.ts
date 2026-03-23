import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let totalProcessed = 0;

  try {
    // Get all active bot configs
    const { data: configs, error: configErr } = await supabase
      .from('telegram_bot_configs')
      .select('*')
      .eq('is_active', true);

    if (configErr) {
      console.error('❌ Error fetching bot configs:', configErr);
      return new Response(JSON.stringify({ error: configErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No active bots', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📡 Polling ${configs.length} active bot(s)`);

    // Process each bot config
    for (const config of configs) {
      const elapsed = Date.now() - startTime;
      if (MAX_RUNTIME_MS - elapsed < MIN_REMAINING_MS) break;

      try {
        await processBotUpdates(supabase, config, supabaseUrl, supabaseAnonKey, startTime);
        totalProcessed++;
      } catch (err) {
        console.error(`❌ Error processing bot @${config.bot_username}:`, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: totalProcessed, bots: configs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ telegram-poll error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processBotUpdates(
  supabase: ReturnType<typeof createClient>,
  config: any,
  supabaseUrl: string,
  supabaseAnonKey: string,
  startTime: number
) {
  const botToken = config.bot_token;
  const userId = config.user_id;

  // Get stored offset for this bot (use telegram_bot_state but per-bot via a simple approach)
  // For simplicity, store offset in the config's updated_at or use a separate mechanism
  // We'll use getUpdates with offset=0 initially and track via telegram_messages
  
  // Get the latest update_id we've processed for this bot's chat
  const { data: lastMsg } = await supabase
    .from('telegram_messages')
    .select('update_id')
    .eq('user_id', userId)
    .order('update_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const offset = lastMsg ? lastMsg.update_id + 1 : 0;

  // Calculate timeout based on remaining time
  const elapsed = Date.now() - startTime;
  const remainingMs = MAX_RUNTIME_MS - elapsed;
  const timeout = Math.min(30, Math.floor(remainingMs / 1000) - 5);
  
  if (timeout < 1) return;

  console.log(`🔄 Polling @${config.bot_username} (offset: ${offset}, timeout: ${timeout}s)`);

  // Call Telegram getUpdates directly with user's bot token
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offset,
      timeout,
      allowed_updates: ['message']
    })
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    console.error(`❌ getUpdates failed for @${config.bot_username}:`, data);
    return;
  }

  const updates = data.result ?? [];
  if (updates.length === 0) {
    console.log(`📭 No new messages for @${config.bot_username}`);
    return;
  }

  console.log(`📨 ${updates.length} new update(s) for @${config.bot_username}`);

  for (const update of updates) {
    if (!update.message?.text) continue;

    const chatId = update.message.chat.id;
    const messageText = update.message.text;
    const senderName = [update.message.from?.first_name, update.message.from?.last_name]
      .filter(Boolean).join(' ') || 'Telegram User';

    // Skip /start command
    if (messageText === '/start') {
      // Update telegram_chat_id if not set
      if (!config.telegram_chat_id) {
        await supabase
          .from('telegram_bot_configs')
          .update({ telegram_chat_id: chatId, updated_at: new Date().toISOString() })
          .eq('id', config.id);
      }

      // Send welcome message
      await sendTelegramMessage(botToken, chatId,
        `👋 Welcome to Smartbookly AI!\n\nYou can now chat with your business assistant directly from Telegram. Ask me anything about your schedule, tasks, customers, or business!\n\nExamples:\n• "What's on my calendar today?"\n• "Create a task: Review reports"\n• "How many customers this month?"\n• "Set a reminder in 30 minutes"`
      );

      // Store the update
      await supabase.from('telegram_messages').upsert({
        update_id: update.update_id,
        chat_id: chatId,
        user_id: userId,
        text: messageText,
        raw_update: update,
        processed: true
      }, { onConflict: 'update_id' });

      continue;
    }

    // Store incoming message
    await supabase.from('telegram_messages').upsert({
      update_id: update.update_id,
      chat_id: chatId,
      user_id: userId,
      text: messageText,
      raw_update: update,
      processed: false
    }, { onConflict: 'update_id' });

    // Find or create AI channel for this user
    const aiChannelId = await ensureAIChannel(supabase, userId);
    if (!aiChannelId) {
      console.error(`❌ Could not find/create AI channel for user ${userId}`);
      continue;
    }

    // Save user message to chat_messages so it appears in dashboard
    await supabase.from('chat_messages').insert({
      channel_id: aiChannelId,
      owner_id: userId,
      sender_type: 'admin',
      sender_user_id: userId,
      sender_name: `${senderName} (Telegram)`,
      content: messageText,
      message_type: 'text'
    });

    // Call ai-chat edge function
    try {
      const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          channelId: aiChannelId,
          prompt: messageText,
          ownerId: userId,
          conversationHistory: [],
          senderName: `${senderName} (Telegram)`,
          senderType: 'admin'
        })
      });

      const aiData = await aiResponse.json();

      if (aiData.content) {
        // Send AI response back to Telegram
        // Strip markdown for Telegram (basic cleanup)
        const telegramText = aiData.content
          .replace(/\*\*/g, '*')  // Bold: ** → *
          .replace(/#{1,6}\s/g, '')  // Remove heading markers
          .replace(/```[\s\S]*?```/g, (m: string) => m.replace(/```\w*\n?/g, ''))  // Clean code blocks
          .trim();

        await sendTelegramMessage(botToken, chatId, telegramText);
      }

      // Mark as processed
      await supabase
        .from('telegram_messages')
        .update({ processed: true })
        .eq('update_id', update.update_id);

    } catch (aiErr) {
      console.error(`❌ AI chat error for update ${update.update_id}:`, aiErr);
      await sendTelegramMessage(botToken, chatId,
        '⚠️ Sorry, I encountered an error processing your message. Please try again.'
      );
    }
  }
}

async function ensureAIChannel(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  // Look for existing AI channel
  const { data: existing } = await supabase
    .from('chat_channels')
    .select('id')
    .eq('owner_id', userId)
    .eq('is_ai', true)
    .eq('is_deleted', false)
    .maybeSingle();

  if (existing) return existing.id;

  // Try RPC
  const { data: rpcResult } = await supabase.rpc('ensure_unique_ai_channel', {
    p_owner_id: userId,
    p_user_identity: `A:${userId}`
  });

  if (rpcResult) {
    return typeof rpcResult === 'string' ? rpcResult : (rpcResult as any)?.id ?? null;
  }

  return null;
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  // Telegram has a 4096 char limit per message
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, 4096));
    remaining = remaining.slice(4096);
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'Markdown'
        })
      });

      if (!res.ok) {
        // Retry without parse_mode if Markdown fails
        const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk
          })
        });
        if (!retryRes.ok) {
          console.error('❌ Failed to send Telegram message:', await retryRes.text());
        }
      }
    } catch (err) {
      console.error('❌ sendTelegramMessage error:', err);
    }
  }
}
