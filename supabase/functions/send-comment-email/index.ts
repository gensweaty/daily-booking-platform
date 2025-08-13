import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

// Dedup emails to prevent duplicates within a short window (same method as reminders)
const recentlySent = new Map<string, number>();
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentlySent) {
    if (now - ts > DEDUP_WINDOW_MS) recentlySent.delete(key);
  }
}, 60 * 1000);

interface SendCommentEmailPayload {
  taskId: string;
  commentId?: string;
  actorName?: string;
  actorType?: string;
  actorEmail?: string;
  content?: string;
  baseUrl?: string; // e.g. https://smartbookly.com or http://localhost:5173
}

const getBaseUrl = (req: Request, bodyBase?: string) => {
  if (bodyBase) return bodyBase.replace(/\/$/, "");
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "https://smartbookly.com"; // safe default
  }
};

// Normalize sub-user display names like "GEO (Sub User)" -> "geo"
const cleanName = (s: string | null | undefined) => (s || '')
  .toLowerCase()
  .replace(/\(.*?\)/g, '')
  .replace(/sub user/gi, '')
  .trim();

const htmlTemplate = (
  subject: string,
  title: string,
  actor: string,
  preview: string,
  dashboardUrl: string,
  publicUrl?: string
) => `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin:0 auto;">
    <div style="padding:20px; border:1px solid #eee; border-radius:10px">
      <h2 style="margin:0 0 10px 0;">${subject}</h2>
      <p style="margin:0 0 8px 0; color:#555;">Task: <strong>${title}</strong></p>
      <p style="margin:0 0 8px 0; color:#555;">From: <strong>${actor}</strong></p>
      ${preview ? `<div style="background:#f8f9fb; padding:12px; border-radius:8px; margin:12px 0; color:#333;">${preview}</div>` : ""}
      <div style="margin:16px 0; display:flex; gap:12px;">
        <a href="${dashboardUrl}" style="background:#4f46e5; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; display:inline-block">Open in Dashboard</a>
        ${publicUrl ? `<a href="${publicUrl}" style="background:#111827; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; display:inline-block">Open in Public Board</a>` : ""}
      </div>
      <p style="font-size:12px; color:#888; margin-top:16px;">You are receiving this because a new comment was added to your task.</p>
    </div>
  </div>
`;

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: SendCommentEmailPayload = await req.json();
    console.log('📧 send-comment-email invoked', { taskId: payload?.taskId, commentId: payload?.commentId, actorName: payload?.actorName, actorType: payload?.actorType });
    if (!payload?.taskId) {
      return new Response(JSON.stringify({ error: 'taskId is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const baseUrl = getBaseUrl(req, payload.baseUrl);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load task
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .select("id, title, user_id, created_by_name, created_by_type, external_user_email")
      .eq("id", payload.taskId)
      .maybeSingle();

    if (taskErr || !task) {
      throw new Error(`Task not found: ${payload.taskId}`);
    }

    // Load comment if not provided
    let commentContent = payload.content || "";
    if (!commentContent && payload.commentId) {
      const { data: commentRow } = await supabase
        .from("task_comments")
        .select("content, created_by_name, created_by_type")
        .eq("id", payload.commentId)
        .maybeSingle();
      if (commentRow) {
        commentContent = commentRow.content || "";
        if (!payload.actorName) payload.actorName = commentRow.created_by_name || undefined;
        if (!payload.actorType) payload.actorType = commentRow.created_by_type || undefined;
      }
    }

    const preview = commentContent ? commentContent.slice(0, 300) : "New comment received";
    const actorName = payload.actorName || "Someone";

    // Get all data in a single optimized query batch with timeout
    const queryPromise = Promise.all([
      // Owner email
      supabase.auth.admin.getUserById(task.user_id).then(res => res?.data?.user?.email ?? null).catch(() => null),
      // Public board slug  
      supabase.from("public_boards").select("slug").eq("user_id", task.user_id).eq("is_active", true).limit(1).maybeSingle().then(res => res?.data?.slug || null).catch(() => null),
      // Sub-users and previous commenters in one batch
      Promise.all([
        supabase.from("sub_users").select("email, fullname").eq("board_owner_id", task.user_id).then(res => res?.data || []).catch(() => []),
        supabase.from('task_comments').select('created_by_name, created_by_type').eq('task_id', payload.taskId).neq('id', payload.commentId || '').is('deleted_at', null).then(res => res?.data || []).catch(() => [])
      ])
    ]);

    // Add 10 second timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 10000)
    );

    const [ownerEmail, publicSlug, [subUsers, commenters]] = await Promise.race([queryPromise, timeoutPromise]) as [string | null, string | null, [Array<{ email: string; fullname: string | null }>, Array<{ created_by_name: string | null; created_by_type: string | null }>]];


    // Build links
    const dashboardLink = `${baseUrl}/dashboard?openTask=${task.id}`;
    const publicLink = publicSlug ? `${baseUrl}/board/${publicSlug}?openTask=${task.id}` : undefined;

    // Determine if self-comment (skip sending to self) - only for real owner/admin comments
    const actorType = (payload.actorType || "").toLowerCase();
    const actorEmail = (payload.actorEmail || "").trim().toLowerCase();
    const ownerEmailLower = ownerEmail?.trim().toLowerCase() || null;
    const isOwnerSelfComment = !!(
      ownerEmailLower &&
      actorEmail &&
      ownerEmailLower === actorEmail &&
      (actorType === "owner" || actorType === "admin" || actorType === "user")
    );
    if (isOwnerSelfComment) {
      console.log('Owner/admin self-comment detected: will notify sub-users only', { ownerEmail, actorEmail, actorType, taskId: task.id, commentId: payload.commentId });
      // Do not early return; exclude the actor later from recipients
    }

    // Build participant recipients per rules: notify creator or anyone who has commented; exclude actor
    const recipients = new Set<string>();

    // Removed global sub-user map; resolve emails only for actual commenter names to avoid notifying unrelated sub-users

    // Include task creator if eligible
    const createdByType = (task.created_by_type || '').toLowerCase();
    const createdByNameLower = (task.created_by_name || '').trim().toLowerCase();
    if (["owner", "admin", "user"].includes(createdByType)) {
      if (ownerEmailLower) recipients.add(ownerEmailLower);
    } else if (["external_user", "sub_user"].includes(createdByType)) {
      const creatorEmailLower = (task.external_user_email || '').trim().toLowerCase();
      if (creatorEmailLower) recipients.add(creatorEmailLower);
    }

    // Use pre-loaded commenters data (no additional query needed)

    let ownerCommented = false;
    const subUserNames = new Set<string>();
    for (const c of commenters || []) {
      const t = (c.created_by_type || '').toLowerCase();
      const name = (c.created_by_name || '').trim();
      if (["owner","admin","user"].includes(t)) {
        ownerCommented = true;
      } else if (["external_user","sub_user"].includes(t) && name) {
        subUserNames.add(name);
      }
    }
    if (ownerCommented && ownerEmailLower) recipients.add(ownerEmailLower);

    if (subUserNames.size > 0) {
      const nameMap = new Map(subUsers.map(su => [cleanName(su.fullname), (su.email || '').trim().toLowerCase()]));
      for (const nm of subUserNames) {
        const email = nameMap.get(cleanName(nm));
        if (email) recipients.add(email);
      }
    }

    // Exclude actor (do not email the person who just commented)
    let actorEmailResolved = actorEmail;
    if (!actorEmailResolved) {
      if (["owner","admin","user"].includes(actorType)) {
        actorEmailResolved = ownerEmailLower;
      } else if (["external_user","sub_user"].includes(actorType)) {
        const actorNameTrim = (payload.actorName || '').trim();
        if (actorNameTrim) {
          const nameMap = new Map(subUsers.map(su => [cleanName(su.fullname), (su.email || '').trim().toLowerCase()]));
          actorEmailResolved = nameMap.get(cleanName(actorNameTrim)) || null;
        }
      }
    }
    if (actorEmailResolved) recipients.delete(actorEmailResolved);

    if (recipients.size === 0) {
      console.log('No recipients for comment email after filtering', { ownerEmail, actorType, actorName: payload.actorName });
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const subject = `New comment on "${task.title || "Task"}"`;
    const html = htmlTemplate(subject, task.title || "Task", actorName, preview, dashboardLink, publicLink);

    // Send email
    const to = Array.from(recipients);
    console.log("Sending comment email to:", to);

    // Dedup check (avoid resending within window)
    const dedupKey = `${task.id}:${payload.commentId || preview.slice(0, 50)}`;
    const nowTs = Date.now();
    const lastTs = recentlySent.get(dedupKey) || 0;
    if (nowTs - lastTs < DEDUP_WINDOW_MS) {
      console.log('Skipping duplicate comment email within dedup window', { dedupKey });
      return new Response(JSON.stringify({ message: 'Duplicate skipped' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const emailRes = await resend.emails.send({
      from: 'SmartBookly <noreply@smartbookly.com>',
      to,
      subject,
      html,
    });

    recentlySent.set(dedupKey, nowTs);

    return new Response(JSON.stringify({ ok: true, to, emailRes }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-comment-email error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
