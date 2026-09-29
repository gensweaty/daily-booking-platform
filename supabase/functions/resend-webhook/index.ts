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
