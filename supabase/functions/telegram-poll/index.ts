import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cron fires every 60s — stay comfortably below that so two invocations never
// long-poll the same bot at once (Telegram rejects concurrent getUpdates).
const MAX_RUNTIME_MS = 45_000;
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

    // Keep long-polling in a loop for the whole invocation window instead of a
    // single pass. The cron fires once a minute, so a single 30s long-poll left
    // a dead window where new messages waited up to ~60s before being picked up.
    while (MAX_RUNTIME_MS - (Date.now() - startTime) >= MIN_REMAINING_MS) {
      for (const config of configs) {
        if (MAX_RUNTIME_MS - (Date.now() - startTime) < MIN_REMAINING_MS) break;

        try {
          await processBotUpdates(supabase, config, supabaseUrl, supabaseAnonKey, startTime, configs.length);
          totalProcessed++;
        } catch (err) {
          console.error(`❌ Error processing bot @${config.bot_username}:`, err);
        }
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

// ── Extract file info from a Telegram message ──────────────────────────
interface TelegramFileInfo {
  fileId: string;
  filename: string;
  contentType: string;
  caption?: string;
}

function extractFileInfo(message: any): TelegramFileInfo | null {
  // Photo — pick the largest resolution
  if (message.photo && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    return {
      fileId: largest.file_id,
      filename: `photo_${Date.now()}.jpg`,
      contentType: 'image/jpeg',
      caption: message.caption,
    };
  }

  // Document (PDF, DOCX, XLSX, any file)
  if (message.document) {
    return {
      fileId: message.document.file_id,
      filename: message.document.file_name || `document_${Date.now()}`,
      contentType: message.document.mime_type || 'application/octet-stream',
      caption: message.caption,
    };
  }

  // Voice message
  if (message.voice) {
    return {
      fileId: message.voice.file_id,
      filename: `voice_${Date.now()}.ogg`,
      contentType: message.voice.mime_type || 'audio/ogg',
      caption: message.caption,
    };
  }

  // Audio file
  if (message.audio) {
    const ext = message.audio.mime_type?.split('/')[1] || 'mp3';
    return {
      fileId: message.audio.file_id,
      filename: message.audio.file_name || `audio_${Date.now()}.${ext}`,
      contentType: message.audio.mime_type || 'audio/mpeg',
      caption: message.caption,
    };
  }

  // Video
  if (message.video) {
    return {
      fileId: message.video.file_id,
      filename: message.video.file_name || `video_${Date.now()}.mp4`,
      contentType: message.video.mime_type || 'video/mp4',
      caption: message.caption,
    };
  }

  // Video note (round video)
  if (message.video_note) {
    return {
      fileId: message.video_note.file_id,
      filename: `video_note_${Date.now()}.mp4`,
      contentType: 'video/mp4',
      caption: message.caption,
    };
  }

  // Sticker
  if (message.sticker) {
    const isAnimated = message.sticker.is_animated;
    return {
      fileId: message.sticker.file_id,
      filename: `sticker_${Date.now()}.${isAnimated ? 'tgs' : 'webp'}`,
      contentType: isAnimated ? 'application/x-tgsticker' : 'image/webp',
      caption: message.caption,
    };
  }

  return null;
}

// ── Download file from Telegram, upload to Supabase Storage ────────────
async function downloadAndUploadFile(
  botToken: string,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fileInfo: TelegramFileInfo
): Promise<{ file_path: string; filename: string; content_type: string; size: number } | null> {
  try {
    // Step 1: Get file path from Telegram
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileInfo.fileId }),
      }
    );
    const getFileData = await getFileRes.json();
    if (!getFileRes.ok || !getFileData.ok) {
      console.error('❌ getFile failed:', getFileData);
      return null;
    }

    const telegramFilePath = getFileData.result.file_path;
    const fileSize = getFileData.result.file_size || 0;

    // Step 2: Download the file bytes
    const downloadRes = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`
    );
    if (!downloadRes.ok) {
      console.error('❌ File download failed:', downloadRes.status);
      return null;
    }

    const fileBytes = new Uint8Array(await downloadRes.arrayBuffer());

    // Step 3: Upload to Supabase Storage (chat-files bucket)
    const storagePath = `telegram/${userId}/${Date.now()}_${fileInfo.filename}`;
    const { error: uploadErr } = await supabase.storage
      .from('chat_attachments')
      .upload(storagePath, fileBytes, {
        contentType: fileInfo.contentType,
        upsert: false,
      });

    if (uploadErr) {
      console.error('❌ Upload to chat_attachments failed:', uploadErr.message);
      return null;
    }

    console.log(`✅ File uploaded: ${storagePath} (${fileBytes.length} bytes)`);
    return {
      file_path: storagePath,
      filename: fileInfo.filename,
      content_type: fileInfo.contentType,
      size: fileSize || fileBytes.length,
    };
  } catch (err) {
    console.error('❌ downloadAndUploadFile error:', err);
    return null;
  }
}

// ── Process updates for a single bot ───────────────────────────────────
async function processBotUpdates(
  supabase: ReturnType<typeof createClient>,
  config: any,
  supabaseUrl: string,
  supabaseAnonKey: string,
  startTime: number,
  botCount = 1
) {
  const botToken = config.bot_token;
  const userId = config.user_id;

  const { data: lastMsg } = await supabase
    .from('telegram_messages')
    .select('update_id')
    .eq('user_id', userId)
    .order('update_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const offset = lastMsg ? lastMsg.update_id + 1 : 0;

  const elapsed = Date.now() - startTime;
  const remainingMs = MAX_RUNTIME_MS - elapsed;
  // With several bots we round-robin, so keep each long-poll short to avoid one
  // idle bot blocking another bot's incoming messages.
  const maxWait = botCount > 1 ? 5 : 20;
  const timeout = Math.min(maxWait, Math.floor(remainingMs / 1000) - 5);
  if (timeout < 1) return;

  console.log(`🔄 Polling @${config.bot_username} (offset: ${offset}, timeout: ${timeout}s)`);

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

  // 🟢 Fire typing indicator for EVERY incoming chat IMMEDIATELY,
  // before we start the sequential per-update processing. Otherwise the
  // user who sent update #2 sees nothing while update #1's AI call runs.
  const seenChatIds = new Set<number>();
  for (const u of updates) {
    const cid = u.message?.chat?.id;
    if (cid && !seenChatIds.has(cid)) {
      seenChatIds.add(cid);
      // Await so the request actually leaves before we move on to heavy work.
      await sendChatAction(botToken, cid, 'typing').catch(() => {});
    }
  }

  for (const update of updates) {
    const message = update.message;
    if (!message) continue;

    const chatId = message.chat.id;
    const senderName = [message.from?.first_name, message.from?.last_name]
      .filter(Boolean).join(' ') || 'Telegram User';

    // Refresh typing indicator for THIS chat right before its processing starts
    // (Telegram clears the action after ~5s). Awaited so it flushes immediately.
    await sendChatAction(botToken, chatId, 'typing').catch(() => {});

    const messageText = message.text || message.caption || '';
    const fileInfo = extractFileInfo(message);

    // Always keep the outbound chat id in sync so reminders/notifications can
    // reach this user even if they never sent /start.
    if (config.telegram_chat_id !== chatId) {
      await supabase
        .from('telegram_bot_configs')
        .update({ telegram_chat_id: chatId, updated_at: new Date().toISOString() })
        .eq('id', config.id);
      config.telegram_chat_id = chatId;
    }

    const hasText = messageText && messageText.trim().length > 0;
    const hasFile = fileInfo !== null;

    // Capture Telegram reply context so AI understands "this reminder / that task"
    // when user long-presses → Reply to a previous bot message.
    const replyToMsg = (message as any).reply_to_message;
    const replyToPayload = replyToMsg
      ? {
          id: String(replyToMsg.message_id ?? ''),
          content: (replyToMsg.text || replyToMsg.caption || '').toString().slice(0, 2000),
          sender_name: replyToMsg.from?.is_bot
            ? 'Smartbookly AI'
            : [replyToMsg.from?.first_name, replyToMsg.from?.last_name].filter(Boolean).join(' ') || 'User',
          sender_type: replyToMsg.from?.is_bot ? 'admin' : 'admin',
          message_type: replyToMsg.document || replyToMsg.photo || replyToMsg.voice || replyToMsg.audio ? 'file' : 'text',
          created_at: replyToMsg.date ? new Date(replyToMsg.date * 1000).toISOString() : null,
          telegram_message_id: replyToMsg.message_id ?? null,
        }
      : null;

    // Skip if no text AND no file (e.g. service messages)
    if (!hasText && !hasFile) {
      // Still store the update so offset advances
      await supabase.from('telegram_messages').upsert({
        update_id: update.update_id,
        chat_id: chatId,
        user_id: userId,
        text: '',
        raw_update: update,
        processed: true
      }, { onConflict: 'update_id' });
      continue;
    }

    // Handle /start command
    if (messageText === '/start') {
      if (!config.telegram_chat_id) {
        await supabase
          .from('telegram_bot_configs')
          .update({ telegram_chat_id: chatId, updated_at: new Date().toISOString() })
          .eq('id', config.id);
      }

      await sendTelegramMessage(botToken, chatId,
        `👋 Welcome to Smartbookly AI!\n\nYou can now chat with your business assistant directly from Telegram. Ask me anything about your schedule, tasks, customers, or business!\n\nYou can also send:\n📷 Photos & images for analysis\n📎 Documents (PDF, DOCX, XLSX)\n🎤 Voice messages\n🎵 Audio files\n\nExamples:\n• "What's on my calendar today?"\n• "Create a task: Review reports"\n• Send a photo of a receipt for analysis\n• Send a voice message with instructions`
      );

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
      text: messageText || (hasFile ? `[File: ${fileInfo!.filename}]` : ''),
      raw_update: update,
      processed: false
    }, { onConflict: 'update_id' });

    // Find or create AI channel
    const aiChannelId = await ensureAIChannel(supabase, userId);
    if (!aiChannelId) {
      console.error(`❌ Could not find/create AI channel for user ${userId}`);
      continue;
    }

    // Download and upload file if present
    let uploadedFile: { file_path: string; filename: string; content_type: string; size: number } | null = null;
    if (hasFile) {
      console.log(`📁 Downloading file: ${fileInfo!.filename} (${fileInfo!.contentType})`);
      // Let user know we're working on it (Telegram clears action after ~5s)
      sendChatAction(botToken, chatId, fileInfo!.contentType).catch(() => {});
      uploadedFile = await downloadAndUploadFile(botToken, supabase, userId, fileInfo!);
      if (uploadedFile) {
        console.log(`✅ File ready: ${uploadedFile.file_path}`);
      } else {
        console.error(`❌ Failed to download/upload file: ${fileInfo!.filename}`);
      }
    }

    // Build chat message content
    const displayContent = messageText || (uploadedFile ? `📎 ${uploadedFile.filename}` : '[File]');

    // Save user message to chat_messages
    const { data: chatMsg, error: chatMsgErr } = await supabase.from('chat_messages').insert({
      channel_id: aiChannelId,
      owner_id: userId,
      sender_type: 'admin',
      sender_user_id: userId,
      sender_name: `${senderName} (Telegram)`,
      content: displayContent,
      message_type: uploadedFile ? 'file' : 'text',
      has_attachments: !!uploadedFile,
    }).select('id').single();

    if (chatMsgErr) {
      console.error('❌ Error saving chat message:', chatMsgErr);
    }

    // Save file attachment record if we have one
    if (uploadedFile && chatMsg?.id) {
      await supabase.from('chat_message_files').insert({
        message_id: chatMsg.id,
        filename: uploadedFile.filename,
        file_path: uploadedFile.file_path,
        content_type: uploadedFile.content_type,
        size: uploadedFile.size,
      });
    }

    // Build attachments array for AI
    const aiAttachments = uploadedFile ? [{
      filename: uploadedFile.filename,
      file_path: uploadedFile.file_path,
      content_type: uploadedFile.content_type,
      size: uploadedFile.size,
    }] : [];

    // Build prompt for AI
    let aiPrompt = messageText || '';
    if (uploadedFile && !aiPrompt) {
      const kind = uploadedFile.content_type.startsWith('image/')
        ? 'image'
        : uploadedFile.content_type.startsWith('audio/')
          ? 'voice/audio message'
          : uploadedFile.content_type === 'application/pdf'
            ? 'PDF document'
            : 'file';
      aiPrompt = `I've sent you a ${kind} (${uploadedFile.filename}). Please analyze its contents and tell me what's in it. If it's a voice message, transcribe it and respond to what I said.`;
    } else if (uploadedFile && aiPrompt) {
      aiPrompt = `${aiPrompt}\n\n[Attached file: ${uploadedFile.filename} (${uploadedFile.content_type})]`;
    }

    // Fetch user's timezone from profile so AI handles time correctly
    let userTimezone = 'UTC';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.timezone) {
        userTimezone = profile.timezone;
      }
    } catch (tzErr) {
      console.error('⚠️ Failed to fetch user timezone, defaulting to UTC:', tzErr);
    }

    // Compute tzOffsetMinutes from the user's IANA timezone (same as browser getTimezoneOffset())
    // getTimezoneOffset() returns negative for UTC+ zones: UTC+4 → -240
    function computeTzOffsetMinutes(tz: string): number {
      try {
        const now = new Date();
        const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
        const localStr = now.toLocaleString('en-US', { timeZone: tz });
        const utcDate = new Date(utcStr);
        const localDate = new Date(localStr);
        return (utcDate.getTime() - localDate.getTime()) / 60000;
      } catch {
        return 0;
      }
    }

    const tzOffsetMinutes = computeTzOffsetMinutes(userTimezone);
    const currentLocalTimeISO = new Date().toISOString(); // actual UTC time, same as dashboard

    console.log(`🌍 Timezone: ${userTimezone}, offset: ${tzOffsetMinutes} min, now: ${currentLocalTimeISO}`);

    // Backfill recent conversation history so AI has memory of previously
    // sent files / messages (mirrors website chat behavior).
    let conversationHistory: any[] = [];
    try {
      // Match website behavior (60 messages) for parity in context recall.
      const { data: recentMsgs } = await supabase
        .from('chat_messages')
        .select('id, sender_type, sender_name, content, message_type, has_attachments, metadata, reply_to_id, created_at')
        .eq('channel_id', aiChannelId)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(60);

      conversationHistory = (recentMsgs || [])
        .reverse()
        .map((m: any) => ({
          role: m.sender_name === 'Smartbookly AI' ? 'assistant' : 'user',
          content: m.has_attachments && !m.content ? '[file attachment]' : (m.content || ''),
          messageId: m.id,
          senderType: m.sender_type,
          senderName: m.sender_name,
          messageType: m.message_type,
          replyToId: m.reply_to_id,
          createdAt: m.created_at,
          metadata: m.metadata ?? null,
        }))
        .filter((m: any) => !!m.content);
      console.log(`🧠 Loaded ${conversationHistory.length} prior messages for AI context`);
    } catch (histErr) {
      console.error('⚠️ Failed to backfill conversation history:', histErr);
    }

    // Call ai-chat edge function
    // Keep "typing…" indicator alive while AI processes (Telegram action expires every ~5s)
    const typingInterval = setInterval(() => {
      sendChatAction(botToken, chatId, 'typing').catch(() => {});
    }, 4000);
    // Fire one immediately so the indicator appears without delay
    sendChatAction(botToken, chatId, 'typing').catch(() => {});
    try {
      const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          channelId: aiChannelId,
          prompt: aiPrompt,
          ownerId: userId,
          conversationHistory,
          userTimezone: userTimezone,
          tzOffsetMinutes: tzOffsetMinutes,
          currentLocalTime: currentLocalTimeISO,
          attachments: aiAttachments,
          senderName: `${senderName} (Telegram)`,
          senderType: 'admin',
          source: 'telegram',
          replyTo: replyToPayload
        })
      });

      let aiData: any = null;
      try {
        aiData = await aiResponse.json();
      } catch {
        aiData = null;
      }

      if (!aiResponse.ok || !aiData) {
        console.error('❌ ai-chat returned a non-OK response', aiResponse.status, aiData);
        const reason = aiData?.error ? String(aiData.error).slice(0, 500) : '';
        await sendTelegramMessage(
          botToken,
          chatId,
          reason
            ? `⚠️ ${reason}`
            : '⚠️ I could not process that right now. Please try again in a moment.'
        );
      } else if (aiData.content) {

        const telegramText = aiData.content
          .replace(/\*\*/g, '*')
          .replace(/#{1,6}\s/g, '')
          .replace(/```[\s\S]*?```/g, (m: string) => m.replace(/```\w*\n?/g, ''))
          .trim();

        if (telegramText) {
          await sendTelegramMessage(botToken, chatId, telegramText);
        } else {
          await sendTelegramMessage(botToken, chatId, '✅ Done.');
        }
      } else if (aiData.error) {
        await sendTelegramMessage(botToken, chatId, `⚠️ ${String(aiData.error).slice(0, 500)}`);
      } else {
        // Never stay silent — always acknowledge the user
        await sendTelegramMessage(botToken, chatId, '✅ Done.');
      }

      // Screenshot follow-up: warn if the browser never delivered the capture
      if (aiData?.screenshot_pending && aiData?.screenshot_request_id) {
        const reqId = aiData.screenshot_request_id;
        const deadline = Date.now() + 40000;
        let delivered = false;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 5000));
          const { data: shot } = await supabase
            .from('screenshot_requests')
            .select('status')
            .eq('id', reqId)
            .maybeSingle();
          if (shot && shot.status !== 'pending') { delivered = true; break; }
          await sendChatAction(botToken, chatId, 'upload_photo').catch(() => {});
        }
        if (!delivered) {
          await sendTelegramMessage(
            botToken,
            chatId,
            '⚠️ I could not capture the screenshot — please open your Smartbookly dashboard in a browser tab and ask again.'
          );
        }
      }

      await supabase
        .from('telegram_messages')
        .update({ processed: true })
        .eq('update_id', update.update_id);

    } catch (aiErr) {
      console.error(`❌ AI chat error for update ${update.update_id}:`, aiErr);
      await sendTelegramMessage(botToken, chatId,
        '⚠️ Sorry, I encountered an error processing your message. Please try again.'
      );
    } finally {
      clearInterval(typingInterval);
    }
  }
}

async function ensureAIChannel(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('chat_channels')
    .select('id')
    .eq('owner_id', userId)
    .eq('is_ai', true)
    .eq('is_deleted', false)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: rpcResult } = await supabase.rpc('ensure_unique_ai_channel', {
    p_owner_id: userId,
    p_user_identity: `A:${userId}`
  });

  if (rpcResult) {
    return typeof rpcResult === 'string' ? rpcResult : (rpcResult as any)?.id ?? null;
  }

  return null;
}

// Map a content type to the most appropriate Telegram chat action so the
// user sees a contextual indicator (e.g. "uploading photo…", "recording…").
function chatActionForContentType(contentType: string): string {
  if (contentType === 'typing') return 'typing';
  if (contentType.startsWith('image/')) return 'upload_photo';
  if (contentType.startsWith('audio/')) return 'record_voice';
  if (contentType.startsWith('video/')) return 'upload_video';
  return 'upload_document';
}

async function sendChatAction(botToken: string, chatId: number, contentTypeOrAction: string) {
  const action = chatActionForContentType(contentTypeOrAction);
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (err) {
    console.error('⚠️ sendChatAction failed:', err);
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
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
