import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "https://esm.sh/resend@4.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INLINE_LIMIT = 20 * 1024 * 1024; // attach directly under this
const TOTAL_LIMIT = 100 * 1024 * 1024;

const htmlToText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const wrap = (inner: string, linkBlock: string, senderName?: string, senderEmail?: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
  <div style="max-width:640px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;">
    <div style="background:#ffffff;border-radius:12px;padding:28px;">
      ${inner}
      ${linkBlock}
    </div>
    <div style="text-align:center;color:#6b7280;font-size:12px;padding:16px 8px;">
      ${senderName ? `${escapeHtml(senderName)}${senderEmail ? ` &lt;${escapeHtml(senderEmail)}&gt;` : ""}<br>` : ""}
      Sent via SmartBookly · <a href="https://smartbookly.com" style="color:#335CF4;">smartbookly.com</a><br>
      <a href="mailto:unsubscribe@smartbookly.com?subject=unsubscribe" style="color:#6b7280;">Unsubscribe</a>
    </div>
  </div>
</body></html>`;

// Minimal, personal-looking layout: no card, no background, no marketing banner,
// no unsubscribe footer and no branding. Plain styling like a normal 1:1 email
// keeps it out of the Promotions tab.
const wrapPlain = (inner: string, linkBlock: string, senderName?: string, senderEmail?: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;">
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222222;line-height:1.6;">
    ${inner}
    ${linkBlock}
    ${senderName ? `<p style="margin:20px 0 0;">${escapeHtml(senderName)}${senderEmail ? `<br><a href="mailto:${escapeHtml(senderEmail)}" style="color:#222222;">${escapeHtml(senderEmail)}</a>` : ""}</p>` : ""}
  </div>
</body></html>`;


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!RESEND_API_KEY) return json({ success: false, error: "Email service not configured" }, 500);

    // --- Auth ---
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ success: false, error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

    // --- Validate payload ---
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ success: false, error: "Invalid body" }, 400);

    const subject = String(body.subject || "").trim();
    const baseHtml = String(body.html || "");
    const plainLayout = body.plain_layout === true;
    const cc: string[] = Array.isArray(body.cc) ? body.cc.filter((e: string) => EMAIL_RE.test(e)) : [];
    const bcc: string[] = Array.isArray(body.bcc) ? body.bcc.filter((e: string) => EMAIL_RE.test(e)) : [];
    const replyTo = typeof body.reply_to === "string" && EMAIL_RE.test(body.reply_to) ? body.reply_to : user.email;

    const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
      .map((r: any) => ({
        email: String(r?.email || "").trim().toLowerCase(),
        subject: String(r?.subject || subject),
        html: String(r?.html || baseHtml),
      }))
      .filter((r: any) => EMAIL_RE.test(r.email));

    if (!subject) return json({ success: false, error: "Subject is required" }, 400);
    if (!recipients.length) return json({ success: false, error: "No valid recipients" }, 400);
    if (recipients.length > 500) return json({ success: false, error: "Too many recipients (max 500)" }, 400);

    const attachments = (Array.isArray(body.attachments) ? body.attachments : []).map((a: any) => ({
      path: String(a?.path || ""),
      filename: String(a?.filename || "file"),
      size: Number(a?.size || 0),
      content_type: String(a?.content_type || "application/octet-stream"),
    })).filter((a: any) => a.path && a.path.startsWith(`${user.id}/`));

    const totalBytes = attachments.reduce((s: number, a: any) => s + a.size, 0);
    if (totalBytes > TOTAL_LIMIT) return json({ success: false, error: "Attachments exceed 100MB" }, 400);

    // --- Sender identity ---
    const { data: profile } = await admin
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    const { data: business } = await admin
      .from("business_profiles")
      .select("business_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const senderName = business?.business_name || profile?.username || user.email?.split("@")[0] || "SmartBookly";
    const fromAddress = `${senderName} via SmartBookly <noreply@smartbookly.com>`;

    // --- Split attachments: inline vs signed links ---
    const inline: { filename: string; content: string; content_type: string }[] = [];
    const links: { filename: string; url: string; size: number }[] = [];
    let inlineBytes = 0;

    for (const att of attachments) {
      const useInline = inlineBytes + att.size <= INLINE_LIMIT;
      if (useInline) {
        const { data: fileData, error: dlErr } = await admin.storage.from("email-attachments").download(att.path);
        if (dlErr || !fileData) {
          console.error("download failed", att.path, dlErr?.message);
          continue;
        }
        const buf = new Uint8Array(await fileData.arrayBuffer());
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < buf.length; i += chunk) {
          binary += String.fromCharCode(...buf.subarray(i, i + chunk));
        }
        inline.push({ filename: att.filename, content: btoa(binary), content_type: att.content_type });
        inlineBytes += att.size;
      } else {
        const { data: signed, error: sErr } = await admin.storage
          .from("email-attachments")
          .createSignedUrl(att.path, 60 * 60 * 24 * 30);
        if (sErr || !signed?.signedUrl) {
          console.error("signed url failed", att.path, sErr?.message);
          continue;
        }
        links.push({ filename: att.filename, url: signed.signedUrl, size: att.size });
      }
    }

    const linkBlock = links.length
      ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
          <p style="font-weight:bold;margin:0 0 8px;">Attached files</p>
          <ul style="padding-left:18px;margin:0;">
            ${links
              .map(
                (l) =>
                  `<li style="margin:4px 0;"><a href="${l.url}" style="color:#335CF4;">${escapeHtml(l.filename)}</a> <span style="color:#6b7280;font-size:12px;">(${(l.size / 1024 / 1024).toFixed(1)} MB)</span></li>`
              )
              .join("")}
          </ul>
          <p style="color:#6b7280;font-size:12px;margin-top:8px;">Download links expire in 30 days.</p>
        </div>`
      : "";

    // --- Send one personalized email per recipient ---
    const resend = new Resend(RESEND_API_KEY);
    const results: { email: string; ok: boolean; id?: string; error?: string }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      try {
        const fullHtml = (plainLayout ? wrapPlain : wrap)(r.html, linkBlock, senderName, replyTo);
        const res = await resend.emails.send({
          from: fromAddress,
          to: [r.email],
          cc: i === 0 && cc.length ? cc : undefined,
          bcc: i === 0 && bcc.length ? bcc : undefined,
          reply_to: replyTo,
          subject: r.subject || subject,
          html: fullHtml,
          text: htmlToText(r.html) + (links.length ? `\n\nAttached files:\n${links.map((l) => `${l.filename}: ${l.url}`).join("\n")}` : ""),
          attachments: inline.length ? inline : undefined,
          headers: {
            "X-Entity-Ref-ID": `sb-crm-${user.id.slice(0, 8)}-${Date.now()}-${i}`,
            "List-Unsubscribe": "<mailto:unsubscribe@smartbookly.com>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if ((res as any)?.error) {
          results.push({ email: r.email, ok: false, error: (res as any).error.message || "Send failed" });
        } else {
          results.push({ email: r.email, ok: true, id: (res as any)?.data?.id || (res as any)?.id });
        }
      } catch (e: any) {
        results.push({ email: r.email, ok: false, error: e?.message || "Send failed" });
      }
      // throttle to protect domain reputation
      if (i < recipients.length - 1) await sleep(600);
    }

    const sent = results.filter((r) => r.ok).length;
    return json({ success: true, sent, failed: results.length - sent, results });
  } catch (error) {
    console.error("send-crm-bulk-email error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
