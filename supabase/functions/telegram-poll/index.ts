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
      .from('chat-files')
      .upload(storagePath, fileBytes, {
        contentType: fileInfo.contentType,
        upsert: false,
      });

    if (uploadErr) {
      // If bucket doesn't exist, try event-files as fallback
      console.error('❌ Upload to chat-files failed:', uploadErr.message);
      const { error: fallbackErr } = await supabase.storage
        .from('event-files')
        .upload(storagePath, fileBytes, {
          contentType: fileInfo.contentType,
          upsert: false,
        });
      if (fallbackErr) {
        console.error('❌ Fallback upload also failed:', fallbackErr.message);
        return null;
      }
      return {
        file_path: storagePath,
        filename: fileInfo.filename,
        content_type: fileInfo.contentType,
        size: fileSize || fileBytes.length,
      };
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
  startTime: number
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
  const timeout = Math.min(30, Math.floor(remainingMs / 1000) - 5);
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

  for (const update of updates) {
    const message = update.message;
    if (!message) continue;

    const chatId = message.chat.id;
    const senderName = [message.from?.first_name, message.from?.last_name]
      .filter(Boolean).join(' ') || 'Telegram User';

    const messageText = message.text || message.caption || '';
    const fileInfo = extractFileInfo(message);
    const hasText = messageText && messageText.trim().length > 0;
    const hasFile = fileInfo !== null;

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
      aiPrompt = `I've sent a file: ${uploadedFile.filename} (${uploadedFile.content_type}). Please analyze it.`;
    } else if (uploadedFile && aiPrompt) {
      aiPrompt = `${aiPrompt}\n\n[Attached file: ${uploadedFile.filename} (${uploadedFile.content_type})]`;
    }

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
          prompt: aiPrompt,
          ownerId: userId,
          conversationHistory: [],
          attachments: aiAttachments,
          senderName: `${senderName} (Telegram)`,
          senderType: 'admin'
        })
      });

      const aiData = await aiResponse.json();

      if (aiData.content) {
        const telegramText = aiData.content
          .replace(/\*\*/g, '*')
          .replace(/#{1,6}\s/g, '')
          .replace(/```[\s\S]*?```/g, (m: string) => m.replace(/```\w*\n?/g, ''))
          .trim();

        await sendTelegramMessage(botToken, chatId, telegramText);
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
