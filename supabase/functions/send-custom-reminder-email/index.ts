import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Track recently sent emails to prevent duplicates
const recentlySentEmails = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentlySentEmails.entries()) {
    if (now - timestamp > DUPLICATE_WINDOW_MS) {
      recentlySentEmails.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

interface CustomReminderEmailRequest {
  reminderId: string;
  userEmail: string;
  title: string;
  message?: string;
  reminderTime: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { reminderId, userEmail, title, message, reminderTime }: CustomReminderEmailRequest = await req.json();

    // Validate required fields
    if (!reminderId || !userEmail || !title) {
      console.error("❌ Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for duplicate email
    const emailKey = `${reminderId}-${userEmail}`;
    const lastSent = recentlySentEmails.get(emailKey);
    if (lastSent && Date.now() - lastSent < DUPLICATE_WINDOW_MS) {
      console.log(`⚠️ Duplicate email prevented for ${emailKey}`);
      return new Response(
        JSON.stringify({ success: true, message: "Email already sent recently" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`📧 Sending custom reminder email for reminder ${reminderId} to ${userEmail}`);

    const emailResponse = await resend.emails.send({
      from: "Smartbookly <onboarding@resend.dev>",
      to: [userEmail],
      subject: `🔔 Reminder: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Reminder Alert</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
            
            ${message ? `
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="color: #4b5563; margin: 0; line-height: 1.6;">${message}</p>
              </div>
            ` : ''}
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                <strong>⏰ Scheduled for:</strong> ${new Date(reminderTime).toLocaleString()}
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This reminder was scheduled through Smartbookly AI
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("❌ Resend API error:", emailResponse.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResponse.error.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark as sent
    recentlySentEmails.set(emailKey, Date.now());
    console.log("✅ Custom reminder email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse.data }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error sending custom reminder email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
