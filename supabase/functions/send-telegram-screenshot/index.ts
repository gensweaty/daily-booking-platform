import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, image_url, caption } = await req.json();
    if (!user_id || !image_url) {
      return new Response(JSON.stringify({ error: "user_id and image_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config } = await supabase
      .from("telegram_bot_configs")
      .select("bot_token, telegram_chat_id")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!config?.bot_token || !config?.telegram_chat_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_telegram_config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch image bytes (signed URL works) and upload to telegram
    const imgRes = await fetch(image_url);
    if (!imgRes.ok) {
      return new Response(JSON.stringify({ error: `image fetch failed: ${imgRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const imgBlob = await imgRes.blob();

    const form = new FormData();
    form.append("chat_id", String(config.telegram_chat_id));
    if (caption) form.append("caption", caption);
    form.append("photo", imgBlob, "screenshot.png");

    const tgRes = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    const tgData = await tgRes.json();

    return new Response(JSON.stringify({ success: tgRes.ok, telegram: tgData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: tgRes.ok ? 200 : 502,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});