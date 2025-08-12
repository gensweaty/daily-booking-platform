import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

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
      .select("id, title, user_id")
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

    // Get owner email via Admin API
    let ownerEmail: string | null = null;
    try {
      const { data: ownerRes } = await supabase.auth.admin.getUserById(task.user_id);
      ownerEmail = ownerRes?.user?.email ?? null;
    } catch (e) {
      console.log("Owner email lookup failed", e);
    }

    // Get public board slug (optional)
    let publicSlug: string | null = null;
    const { data: board } = await supabase
      .from("public_boards")
      .select("slug")
      .eq("user_id", task.user_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    publicSlug = board?.slug || null;

    // Get sub users
    const { data: subs } = await supabase
      .from("sub_users")
      .select("email")
      .eq("board_owner_id", task.user_id);

    const subEmails = (subs || [])
      .map((s) => (s?.email || "").trim().toLowerCase())
      .filter((e) => !!e);

    // Build links
    const dashboardLink = `${baseUrl}/dashboard?openTask=${task.id}`;
    const publicLink = publicSlug ? `${baseUrl}/board/${publicSlug}?openTask=${task.id}` : undefined;

    // Build recipients: owner + sub users, excluding actor email if known
    const actorEmail = (payload.actorEmail || "").trim().toLowerCase();
    const recipients = new Set<string>();
    if (ownerEmail) recipients.add(ownerEmail.trim().toLowerCase());
    subEmails.forEach((e) => recipients.add(e));
    if (actorEmail) recipients.delete(actorEmail);

    if (recipients.size === 0) {
      console.log('No recipients for comment email', { ownerEmail, subEmails, actorEmail });
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const subject = `New comment on "${task.title || "Task"}"`;
    const html = htmlTemplate(subject, task.title || "Task", actorName, preview, dashboardLink, publicLink);

    // Send email
    const to = Array.from(recipients);
    console.log("Sending comment email to:", to);
      const emailRes = await resend.emails.send({
        from: 'SmartBookly <noreply@smartbookly.com>',
        to,
        subject,
        html,
      });

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
