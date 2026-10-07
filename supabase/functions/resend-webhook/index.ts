// Receives Resend delivery events and updates email_logs.status/reason.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Webhook } from "npm:svix@1.24.0";

const STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "spam",
  "email.failed": "failed",
  "email.opened": "opened",
  "email.clicked": "clicked",
};
// Never downgrade a final state with a later informational one.
const RANK: Record<string, number> = { sent: 1, delayed: 2, delivered: 3, opened: 4, clicked: 5, bounced: 6, spam: 6, failed: 6 };

const OWNER_ADDR_RE = /\br-([0-9a-f-]{36})@/i;

/** Customer replied to a "r-<ownerId>@<inbound domain>" address: store it and forward a copy to the owner. */
async function handleReceived(data: any) {
  const toList: string[] = [].concat(data?.to || []).map(String);
  const match = toList.map((t) => t.match(OWNER_ADDR_RE)).find(Boolean);
  if (!match) return;
  const ownerId = match[1];
  const emailId = data?.email_id || data?.id;
  const key = Deno.env.get("RESEND_API_KEY");
  let html = data?.html || null, text = data?.text || null;
  if (emailId && key && !html && !text) {
    const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, { headers: { Authorization: `Bearer ${key}` } });
    if (r.ok) { const full = await r.json(); html = full?.html ?? null; text = full?.text ?? null; }
    else console.error("fetch received email failed", r.status, await r.text());
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const from = String(data?.from || "unknown");
  const subject = String(data?.subject || "");
  await admin.from("inbound_messages").insert({
    owner_id: ownerId, channel: "email", sender: from, recipient: toList[0] || null, subject,
    body: text, html, provider_id: emailId || null,
  });
  // Forward a copy so the owner still sees replies in their own inbox.
  const { data: u } = await admin.auth.admin.getUserById(ownerId);
  const ownerEmail = u?.user?.email;
  if (key && ownerEmail) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SmartBookly <noreply@smartbookly.com>", to: [ownerEmail], reply_to: from,
        subject: `Reply from ${from}: ${subject}`.slice(0, 250),
        html: html || `<pre style="white-space:pre-wrap;font-family:inherit">${(text || "").replace(/</g, "&lt;")}</pre>`,
      }),
    }).catch((e) => console.error("forward failed", e));
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return new Response("not configured", { status: 500 });

  const payload = await req.text();
  let evt: any;
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    });
  } catch {
    return new Response("invalid signature", { status: 401 });
  }

  if (evt?.type === "email.received") {
    try { await handleReceived(evt.data); } catch (e) { console.error("inbound email failed:", e); }
    return new Response("ok");
  }

  const status = STATUS[evt?.type];
  const id = evt?.data?.email_id;
  if (!status || !id) return new Response("ignored");

  const reason =
    evt.data?.bounce?.message || evt.data?.bounce?.subType || evt.data?.failed?.reason ||
    (status === "spam" ? "Recipient marked the email as spam" : status === "delayed" ? "Delivery delayed by recipient server" : null);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows } = await admin.from("email_logs").select("id,status").eq("resend_id", id);
  for (const r of rows || []) {
    if ((RANK[status] || 0) < (RANK[r.status] || 0)) continue;
    await admin.from("email_logs").update({ status, reason: reason ?? undefined, updated_at: new Date().toISOString() }).eq("id", r.id);
  }
  return new Response("ok");
});
