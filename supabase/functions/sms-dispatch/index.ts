// SMS queue worker. Runs on a schedule (every minute) and can also be invoked
// manually. Drains queued messages, retries temporary failures, expires stale
// ones, and polls provider status for anything the webhook missed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { getProvider } from "../_shared/sms/smsgate.ts";
import {
  dispatchMessage,
  getCredentials,
  getSmsConfig,
  isQuietHours,
  type SmsConfig,
} from "../_shared/sms/service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const nowIso = new Date().toISOString();
  const summary = { expired: 0, sent: 0, retried: 0, polled: 0, failed: 0 };

  try {
    // 1) Expire anything past its TTL.
    const { data: expired } = await admin
      .from("sms_messages")
      .update({ status: "expired", updated_at: nowIso })
      .in("status", ["queued", "sending"])
      .lt("expires_at", nowIso)
      .select("id");
    summary.expired = (expired || []).length;

    // 2) Drain the queue.
    const { data: due } = await admin
      .from("sms_messages")
      .select("*")
      .eq("status", "queued")
      .lte("next_attempt_at", nowIso)
      .order("next_attempt_at", { ascending: true })
      .limit(100);

    const cfgCache = new Map<string, SmsConfig | null>();
    const getCfg = async (uid: string) => {
      if (!cfgCache.has(uid)) cfgCache.set(uid, await getSmsConfig(admin, uid));
      return cfgCache.get(uid) || null;
    };

    for (const msg of due || []) {
      const cfg = await getCfg(msg.user_id);
      if (!cfg || !cfg.is_connected) continue;
      if (!cfg.sms_enabled && msg.purpose !== "test") continue;
      if (isQuietHours(cfg) && msg.purpose !== "test") continue;

      const res = await dispatchMessage(admin, cfg, msg);
      if (res.ok) summary.sent++;
      else if (res.status === "queued") summary.retried++;
      else summary.failed++;
    }

    // 3) Poll status for messages sent but not yet confirmed delivered.
    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: pending } = await admin
      .from("sms_messages")
      .select("id, user_id, provider_message_id, status")
      .eq("status", "sent")
      .not("provider_message_id", "is", null)
      .gte("created_at", cutoff)
      .limit(50);

    for (const msg of pending || []) {
      const cfg = await getCfg(msg.user_id);
      if (!cfg?.is_connected) continue;
      const creds = await getCredentials(admin, cfg);
      if (!creds) continue;
      const status = await getProvider(cfg.provider)
        .getSmsStatus(creds, msg.provider_message_id);
      if (!status || status.status === msg.status) continue;

      const patch: Record<string, unknown> = {
        status: status.status,
        updated_at: new Date().toISOString(),
      };
      if (status.status === "delivered") patch.delivered_at = new Date().toISOString();
      if (status.status === "failed") {
        patch.failed_at = new Date().toISOString();
        patch.error = status.error || "Delivery failed";
      }
      await admin.from("sms_messages").update(patch).eq("id", msg.id);
      summary.polled++;
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sms-dispatch error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
