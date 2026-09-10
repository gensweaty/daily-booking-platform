// Public webhook receiver for SMSGate delivery events (sms:sent, sms:delivered,
// sms:failed). The provider message id is matched against sms_messages, so an
// unmatched or forged payload changes nothing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mapEvent(event: string, payload: any): { status: string; error?: string } | null {
  switch (event) {
    case "sms:sent":
      return { status: "sent" };
    case "sms:delivered":
      return { status: "delivered" };
    case "sms:failed":
      return { status: "failed", error: payload?.reason || payload?.error || "Delivery failed" };
    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const event = String(body.event || "");
    const payload = body.payload || {};
    const providerMessageId = String(payload.messageId || payload.id || body.id || "");

    const mapped = mapEvent(event, payload);
    if (!mapped || !providerMessageId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: msg } = await admin
      .from("sms_messages")
      .select("id, user_id, status")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (!msg) {
      return new Response(JSON.stringify({ ok: true, unmatched: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the signature when the owner's gateway registered one.
    const { data: cfg } = await admin
      .from("sms_provider_configs")
      .select("webhook_secret")
      .eq("user_id", msg.user_id)
      .maybeSingle();

    if (cfg?.webhook_secret) {
      const signature = req.headers.get("x-signature") || "";
      const timestamp = req.headers.get("x-timestamp") || "";
      const expected = await hmacHex(cfg.webhook_secret, `${raw}${timestamp}`);
      if (!signature || signature.replace(/^sha256=/, "") !== expected) {
        return new Response(JSON.stringify({ ok: false, error: "bad signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Never move a delivered message backwards.
    if (msg.status === "delivered" && mapped.status !== "failed") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patch: Record<string, unknown> = {
      status: mapped.status,
      updated_at: new Date().toISOString(),
    };
    if (mapped.status === "sent") patch.sent_at = new Date().toISOString();
    if (mapped.status === "delivered") patch.delivered_at = new Date().toISOString();
    if (mapped.status === "failed") {
      patch.failed_at = new Date().toISOString();
      patch.error = mapped.error;
    }

    await admin.from("sms_messages").update(patch).eq("id", msg.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sms-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
