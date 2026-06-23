import { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Listens for AI-triggered screenshot requests on the current user.
 * When the AI inserts a row in `screenshot_requests`, the browser captures
 * the currently-visible page with html2canvas, uploads it to the private
 * `screenshots` bucket, then writes a chat message with the screenshot into
 * the AI channel and (if the request originated from Telegram) calls
 * `send-telegram-screenshot` to deliver the photo to the bot.
 */
export function ScreenshotRequestListener() {
  const { user } = useAuth();
  const handlingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const handle = async (req: any) => {
      if (!req || req.status !== 'pending') return;
      if (req.user_id !== userId) return;
      if (handlingRef.current.has(req.id)) return;
      handlingRef.current.add(req.id);

      try {
        // 1. Capture current page
        const target = document.body;
        const canvas = await html2canvas(target, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
          logging: false,
          scale: Math.min(window.devicePixelRatio || 1, 2),
        });
        const blob: Blob = await new Promise((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png', 0.92)
        );

        // 2. Upload to private screenshots bucket
        const path = `${userId}/${req.id}.png`;
        const { error: upErr } = await supabase.storage
          .from('screenshots')
          .upload(path, blob, { contentType: 'image/png', upsert: true });
        if (upErr) throw upErr;

        // 3. Signed URL valid 7 days
        const { data: signed, error: signErr } = await supabase.storage
          .from('screenshots')
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signErr || !signed?.signedUrl) throw signErr || new Error('sign failed');
        const imageUrl = signed.signedUrl;

        // 4. Post into AI chat channel as a message with attached image (markdown)
        if (req.ai_channel_id) {
          const caption = req.caption || 'Screenshot';
          const content = `📸 ${caption}\n\n![screenshot](${imageUrl})`;
          await supabase.from('chat_messages').insert({
            channel_id: req.ai_channel_id,
            content,
            sender_type: 'admin',
            sender_user_id: userId,
            sender_name: 'Smartbookly AI',
            owner_id: userId,
            message_type: 'text',
            metadata: { source_kind: 'screenshot', screenshot_request_id: req.id },
          });
        }

        // 5. Forward to Telegram if request came from there
        if (req.via_telegram) {
          await supabase.functions.invoke('send-telegram-screenshot', {
            body: { user_id: userId, image_url: imageUrl, caption: req.caption || 'Screenshot' },
          });
        }

        // 6. Mark fulfilled
        await supabase
          .from('screenshot_requests')
          .update({ status: 'fulfilled', image_url: imageUrl, fulfilled_at: new Date().toISOString() })
          .eq('id', req.id);
      } catch (err: any) {
        console.error('[ScreenshotRequestListener] failed:', err);
        try {
          await supabase
            .from('screenshot_requests')
            .update({ status: 'failed', error: String(err?.message || err) })
            .eq('id', req.id);
        } catch {}
      }
    };

    // Catch up on any pending requests that arrived while the tab was closed (last 2 minutes)
    (async () => {
      const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('screenshot_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true });
      for (const row of data || []) await handle(row);
    })();

    const channel = supabase
      .channel(`screenshot-requests-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'screenshot_requests', filter: `user_id=eq.${userId}` },
        (payload) => handle(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
