import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_APP_BASE_URL = "https://daily-booking-platform.lovable.app";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Server-side screenshot: mints a single-use render token, asks our headless
 * Chromium worker to open /render/<token> and capture the page, then delivers
 * the PNG to the AI chat and (when relevant) Telegram.
 *
 * Falls back to the browser-tab capture path when the worker is unavailable.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let requestId: string | null = null;

  try {
    // Only trusted callers (our own edge functions) may trigger a capture.
    const auth = req.headers.get("authorization") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (auth !== `Bearer ${serviceKey}`) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    requestId = body?.request_id || null;
    if (!requestId) return json({ error: "request_id required" }, 400);

    const { data: reqRow } = await admin
      .from("screenshot_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (!reqRow) return json({ error: "request_not_found" }, 404);

    const workerUrl = Deno.env.get("RENDER_WORKER_URL");
    const workerSecret = Deno.env.get("RENDER_WORKER_SECRET");
    if (!workerUrl || !workerSecret) {
      console.warn("RENDER_WORKER_URL / RENDER_WORKER_SECRET not configured — leaving browser-tab fallback");
      return json({ fallback: true, reason: "worker_not_configured" });
    }

    // Sub-users don't have a Supabase Auth account we can mint a session for.
    // Their captures keep using the browser-tab path.
    const { data: userRes } = await admin.auth.admin.getUserById(reqRow.user_id);
    if (!userRes?.user?.email) {
      return json({ fallback: true, reason: "no_auth_user" });
    }

    const token = randomToken();
    const { error: tokenErr } = await admin.from("render_tokens").insert({
      token_hash: await sha256Hex(token),
      user_id: reqRow.user_id,
      page_hint: reqRow.page_hint,
      popup_target: reqRow.popup_target,
      screenshot_request_id: reqRow.id,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
    });
    if (tokenErr) throw tokenErr;

    const appBaseUrl = (Deno.env.get("RENDER_APP_BASE_URL") || DEFAULT_APP_BASE_URL).replace(/\/$/, "");
    const renderUrl = `${appBaseUrl}/render/${token}`;

    const workerRes = await fetch(workerUrl.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Render-Secret": workerSecret,
      },
      body: JSON.stringify({ url: renderUrl, width: 1440, height: 1000, fullPage: true }),
    });

    if (!workerRes.ok) {
      const details = await workerRes.text();
      console.error(`Render worker failed [${workerRes.status}]: ${details}`);
      return json({ fallback: true, reason: "worker_error", status: workerRes.status, details });
    }

    const pngBytes = new Uint8Array(await workerRes.arrayBuffer());
    if (pngBytes.byteLength < 1000) {
      return json({ fallback: true, reason: "empty_image" });
    }

    const path = `${reqRow.user_id}/${reqRow.id}.png`;
    const { error: upErr } = await admin.storage
      .from("screenshots")
      .upload(path, pngBytes, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await admin.storage
      .from("screenshots")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr || !signed?.signedUrl) throw signErr || new Error("sign_failed");
    const imageUrl = signed.signedUrl;

    const caption = reqRow.caption || "Screenshot";

    if (reqRow.ai_channel_id) {
      await admin.from("chat_messages").insert({
        channel_id: reqRow.ai_channel_id,
        content: `📸 ${caption}\n\n![screenshot](${imageUrl})`,
        sender_type: "admin",
        sender_user_id: reqRow.user_id,
        sender_name: "Smartbookly AI",
        owner_id: reqRow.owner_id || reqRow.user_id,
        message_type: "text",
        metadata: { source_kind: "screenshot", screenshot_request_id: reqRow.id, server_side: true },
      });
    }

    if (reqRow.via_telegram) {
      await admin.functions.invoke("send-telegram-screenshot", {
        body: { user_id: reqRow.user_id, image_url: imageUrl, caption },
      });
    }

    await admin
      .from("screenshot_requests")
      .update({ status: "fulfilled", image_url: imageUrl, fulfilled_at: new Date().toISOString() })
      .eq("id", reqRow.id);

    return json({ success: true, image_url: imageUrl });
  } catch (e) {
    console.error("capture-screenshot error", e);
    // Never mark the request failed — the browser-tab listener can still fulfil it.
    return json({ fallback: true, error: (e as Error).message }, 200);
  }
});
