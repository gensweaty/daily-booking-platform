// SMS Gateway admin API — the only SMS function the frontend talks to.
// Requires the caller's Supabase session; every action is scoped to that user.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { getProvider, SMSGATE_CLOUD_BASE_URL } from "../_shared/sms/smsgate.ts";
import {
  DEFAULT_TEMPLATES,
  getCredentials,
  getSmsConfig,
  sendSms,
  type SmsConfig,
} from "../_shared/sms/service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Always answer 200 so the browser SDK can read the real message instead of
// showing a generic "Edge Function returned a non-2xx status code".
const json = (body: unknown, status = 200) => {
  if (status >= 400) {
    console.error("sms-admin failure:", status, JSON.stringify(body));
  }
  return new Response(JSON.stringify({ ...(body as object), http_status: status }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

/** Never leak credentials to the browser. */
function publicConfig(cfg: SmsConfig | null) {
  if (!cfg) return null;
  const {
    password: _p,
    access_token: _a,
    refresh_token: _r,
    webhook_secret: _w,
    ...safe
  } = cfg as any;
  return { ...safe, has_credentials: Boolean(cfg.username && cfg.password) };
}

async function syncDevices(admin: any, cfg: SmsConfig) {
  const creds = await getCredentials(admin, cfg);
  if (!creds) return [];
  const devices = await getProvider(cfg.provider).getDevices(creds);
  for (const d of devices) {
    await admin.from("sms_devices").upsert({
      user_id: cfg.user_id,
      external_id: d.externalId,
      name: d.name,
      last_seen_at: d.lastSeenAt,
      is_online: d.isOnline,
      sim_cards: d.simCards,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,external_id" });
  }
  const { data } = await admin
    .from("sms_devices")
    .select("*")
    .eq("user_id", cfg.user_id)
    .order("last_seen_at", { ascending: false });
  return data || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user?.id) return json({ error: "Authentication required" }, 401);
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");

    let cfg = await getSmsConfig(admin, userId);

    switch (action) {
      // ── STATUS ────────────────────────────────────────────────────────
      case "status": {
        const devices = cfg
          ? (await admin.from("sms_devices").select("*").eq("user_id", userId)).data || []
          : [];
        const { data: templates } = await admin
          .from("sms_templates").select("*").eq("user_id", userId);
        return json({
          config: publicConfig(cfg),
          devices,
          templates: templates || [],
          defaultTemplates: DEFAULT_TEMPLATES,
        });
      }

      // ── CONNECT ───────────────────────────────────────────────────────
      case "connect": {
        const username = String(body.username || "").trim();
        const password = String(body.password || "").trim();
        const baseUrl = String(body.base_url || SMSGATE_CLOUD_BASE_URL).trim();
        if (!username || !password) {
          return json({ error: "Username and password are required." }, 400);
        }

        const provider = getProvider("smsgate_cloud");
        const verify = await provider.verifyCredentials({ baseUrl, username, password });
        if (!verify.ok) return json({ error: verify.error || "Could not connect." }, 400);

        const tokens = await provider.issueTokens({ baseUrl, username, password });

        const payload = {
          user_id: userId,
          provider: "smsgate_cloud",
          base_url: baseUrl,
          username,
          password,
          access_token: tokens?.accessToken ?? null,
          refresh_token: tokens?.refreshToken ?? null,
          token_expires_at: tokens?.expiresAt ?? null,
          is_connected: true,
          last_verified_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        };

        const { data: saved, error } = await admin
          .from("sms_provider_configs")
          .upsert(payload, { onConflict: "user_id" })
          .select("*")
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);

        cfg = saved as SmsConfig;
        const devices = await syncDevices(admin, cfg);
        return json({ config: publicConfig(cfg), devices });
      }

      // ── DISCONNECT ────────────────────────────────────────────────────
      case "disconnect": {
        if (!cfg) return json({ config: null, devices: [] });
        await admin.from("sms_provider_configs").update({
          username: null,
          password: null,
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          is_connected: false,
          sms_enabled: false,
          updated_at: new Date().toISOString(),
        }).eq("id", cfg.id);
        await admin.from("sms_devices").delete().eq("user_id", userId);
        return json({ config: publicConfig(await getSmsConfig(admin, userId)), devices: [] });
      }

      // ── DEVICES ───────────────────────────────────────────────────────
      case "refresh_devices": {
        if (!cfg?.is_connected) return json({ error: "Gateway is not connected." }, 400);
        return json({ devices: await syncDevices(admin, cfg) });
      }

      // ── SETTINGS ──────────────────────────────────────────────────────
      case "save_settings": {
        if (!cfg) return json({ error: "Connect the gateway first." }, 400);
        const allowed = [
          "sms_enabled",
          "send_on_booking_confirmed",
          "send_on_reminder",
          "send_on_rescheduled",
          "send_on_cancelled",
          "routing_mode",
          "preferred_device_id",
          "preferred_sim_number",
          "default_country_code",
          "message_ttl_seconds",
          "quiet_hours_start",
          "quiet_hours_end",
          "rate_limit_per_minute",
        ];
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of allowed) {
          if (k in (body.settings || {})) update[k] = body.settings[k];
        }
        const { data, error } = await admin
          .from("sms_provider_configs")
          .update(update).eq("id", cfg.id).select("*").maybeSingle();
        if (error) return json({ error: error.message }, 400);
        return json({ config: publicConfig(data as SmsConfig) });
      }

      // ── TEMPLATES ─────────────────────────────────────────────────────
      case "save_template": {
        const purpose = String(body.purpose || "");
        const language = String(body.language || "en").slice(0, 5);
        const tplBody = String(body.body || "").trim();
        if (!purpose || !tplBody) return json({ error: "Missing template text." }, 400);
        const { error } = await admin.from("sms_templates").upsert({
          user_id: userId,
          purpose,
          language,
          body: tplBody,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,purpose,language" });
        if (error) return json({ error: error.message }, 400);
        const { data } = await admin.from("sms_templates").select("*").eq("user_id", userId);
        return json({ templates: data || [] });
      }

      // ── TEST SEND ─────────────────────────────────────────────────────
      case "send_test": {
        if (!cfg?.is_connected) return json({ error: "Connect the gateway first." }, 400);
        const to = String(body.to || "").trim();
        const text = String(body.body || "SmartBookly test message.").trim();
        if (!to) return json({ error: "Enter a phone number." }, 400);
        const res = await sendSms(admin, {
          ownerId: userId,
          to,
          body: text,
          purpose: "test",
          language: body.language || "en",
          force: true,
        });
        if (!res.ok && res.skipped === "invalid_number") {
          return json({ error: "That phone number does not look valid." }, 400);
        }
        if (!res.ok && !res.messageId) {
          return json({ error: res.error || res.skipped || "Could not send." }, 400);
        }
        const { data: msg } = await admin
          .from("sms_messages").select("*").eq("id", res.messageId).maybeSingle();
        return json({ message: msg, ok: res.ok, error: res.error });
      }

      // ── HISTORY ───────────────────────────────────────────────────────
      case "history": {
        const limit = Math.min(200, Number(body.limit) || 50);
        const { data } = await admin
          .from("sms_messages")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return json({ messages: data || [] });
      }

      case "message_status": {
        const id = String(body.id || "");
        const { data } = await admin
          .from("sms_messages").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
        return json({ message: data });
      }

      // ── RETRY ─────────────────────────────────────────────────────────
      case "retry": {
        const id = String(body.id || "");
        const { data: msg } = await admin
          .from("sms_messages").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
        if (!msg) return json({ error: "Message not found." }, 404);
        await admin.from("sms_messages").update({
          status: "queued",
          attempts: 0,
          error: null,
          failed_at: null,
          next_attempt_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", id);
        const fresh = await getSmsConfig(admin, userId);
        if (fresh) {
          const { dispatchMessage } = await import("../_shared/sms/service.ts");
          const { data: reloaded } = await admin
            .from("sms_messages").select("*").eq("id", id).maybeSingle();
          await dispatchMessage(admin, fresh, reloaded);
        }
        const { data: after } = await admin
          .from("sms_messages").select("*").eq("id", id).maybeSingle();
        return json({ message: after });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("sms-admin error:", e);
    return json({ error: String(e) }, 500);
  }
});
