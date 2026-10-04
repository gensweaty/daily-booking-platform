// Receives incoming SMS replies forwarded by the owner's phone gateway (SMS-Gate "sms:received" webhook)
// and stores them in inbound_messages. Signed-in owners can GET their personal webhook URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function sign(ownerId: string) {
  const secret = Deno.env.get("SMS_INBOUND_SECRET")!;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ownerId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const url = new URL(req.url);

  // Owner asks for their personal webhook URL
  if (url.searchParams.get("action") === "url") {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data } = await admin.auth.getUser(token);
    const uid = data?.user?.id;
    if (!uid) return json({ error: "Unauthorized" }, 401);
    const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sms-inbound`;
    return json({ url: `${base}?o=${uid}&k=${await sign(uid)}` });
  }

  if (req.method !== "POST") return json({ ok: true });
  const owner = url.searchParams.get("o") || "";
  const k = url.searchParams.get("k") || "";
  if (!UUID_RE.test(owner) || k !== (await sign(owner))) return json({ error: "invalid link" }, 401);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid body" }, 400);
  if (body.event && body.event !== "sms:received") return json({ ignored: true });
  const p = body.payload ?? body;
  const sender = String(p.phoneNumber || p.sender || p.from || "").slice(0, 64);
  const text = String(p.message ?? p.text ?? p.body ?? "").slice(0, 5000);
  if (!sender || !text) return json({ error: "Missing sender or message" }, 400);
  const providerId = String(p.messageId || body.id || "").slice(0, 200) || null;

  const { error } = await admin.from("inbound_messages").insert({
    owner_id: owner,
    channel: "sms",
    sender,
    body: text,
    provider_id: providerId,
    received_at: p.receivedAt ? new Date(p.receivedAt).toISOString() : new Date().toISOString(),
  });
  if (error && !String(error.message).includes("duplicate")) {
    console.error("sms-inbound insert failed:", error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
});
