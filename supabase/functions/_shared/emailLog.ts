// Records sent emails so owners can see delivery status. Never throws.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

/** Resolve the signed-in user id from the request's Authorization header, if any. */
export async function ownerFromRequest(req: Request): Promise<string | null> {
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const { data } = await admin().auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function logEmail(entry: {
  ownerId: string | null | undefined;
  to: string | string[];
  subject?: string;
  purpose: string;
  result?: { data?: { id?: string } | null; error?: { message?: string } | null } | null;
  error?: unknown;
}) {
  try {
    if (!entry.ownerId) return;
    const recipients = Array.isArray(entry.to) ? entry.to : [entry.to];
    const errMsg =
      entry.result?.error?.message ||
      (entry.error ? (entry.error as Error)?.message || String(entry.error) : null);
    await admin().from("email_logs").insert(
      recipients.map((r) => ({
        owner_id: entry.ownerId,
        resend_id: entry.result?.data?.id ?? null,
        recipient: r,
        subject: entry.subject ?? null,
        purpose: entry.purpose,
        status: errMsg ? "failed" : "sent",
        reason: errMsg,
      })),
    );
  } catch (e) {
    console.error("email log failed (ignored):", e);
  }
}
