import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.4.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { reminderId, userEmail, title, message, reminderTime } = await req.json();

    const API = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("EMAIL_FROM");
    const DEV_ONLY = Deno.env.get("DEV_EMAIL_OVERRIDE");

    if (!API || !FROM) {
      return new Response(JSON.stringify({ success: false, error: "Missing RESEND_API_KEY or EMAIL_FROM" }), { status: 500, headers: cors });
    }

    // For dev/testing: route all mail to a single inbox
    const to = DEV_ONLY || userEmail;

    const resend = new Resend(API);
    const html = `
      <div style="font-family: Inter,system-ui,Arial,sans-serif">
        <h2>🔔 Reminder</h2>
        <p><strong>${title}</strong></p>
        ${message ? `<p>${message}</p>` : ""}
        <p style="color:#666">Scheduled for: ${new Date(reminderTime).toLocaleString()}</p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Reminder: ${title}`,
      html,
      text: `Reminder: ${title}\n\n${message || ""}\n\nScheduled for: ${new Date(reminderTime).toLocaleString()}`,
    });

    if (error) {
      // Propagate provider errors to caller with non-200 status
      return new Response(JSON.stringify({ success: false, error: error.message, provider: "resend" }), { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ success: true, id: data?.id }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), { status: 500, headers: cors });
  }
});
